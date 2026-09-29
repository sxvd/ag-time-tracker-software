import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueDerivedRefresh,
  processDerivedRefresh,
  retryPendingDerivedRefresh
} from '../../backend/utils/derived-refresh'
import { createManualEntry } from '../../backend/utils/store'
import {
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('retryable Breezy and medal refresh', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('commits an entry and its pending refresh marker when processing fails', async () => {
    const { owner, task } = await createDerivedFixtures()
    await makeBreezyDaysUnavailable()
    const entry = await createManualEntry({
      userId: owner.id,
      taskId: task.id,
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: '2026-07-13T10:00:00.000Z',
      feedback: {
        flowQuality: 'Great flow',
        efficiencyFeel: 'Felt efficient',
        energy: 'High',
        note: ''
      },
      blockers: ['None']
    }).finally(restoreBreezyDays)

    expect(await integrationPrisma.timeEntry.findUnique({ where: { id: entry.id } }))
      .not.toBeNull()
    expect(await integrationPrisma.derivedRefreshJob.findUnique({
      where: { userId: owner.id }
    })).toMatchObject({
      attemptCount: 1,
      completedAt: null,
      lastError: expect.stringMatching(/breezy_days/i)
    })
  })

  it('records each failed attempt and retries pending work', async () => {
    const { owner, task } = await createDerivedFixtures()
    await createCompletedEntry(owner.id, task.id)
    await integrationPrisma.$transaction((tx) => enqueueDerivedRefresh(tx, owner.id))

    await makeBreezyDaysUnavailable()
    try {
      await processDerivedRefresh(owner.id)
      await processDerivedRefresh(owner.id)
    } finally {
      await restoreBreezyDays()
    }

    expect(await integrationPrisma.derivedRefreshJob.findUnique({
      where: { userId: owner.id }
    })).toMatchObject({
      attemptCount: 2,
      completedAt: null,
      lastError: expect.stringMatching(/breezy_days/i)
    })

    const retried = await retryPendingDerivedRefresh(owner.id)
    const completed = await integrationPrisma.derivedRefreshJob.findUniqueOrThrow({
      where: { userId: owner.id }
    })
    expect({ retried, completed }).toMatchObject({
      retried: true,
      completed: {
        completedAt: expect.any(Date),
        lastError: null
      }
    })
    expect(await integrationPrisma.breezyDay.count({ where: { userId: owner.id } }))
      .toBe(1)
    expect(await integrationPrisma.userMedal.count({ where: { userId: owner.id } }))
      .toBe(1)
  })

  it('produces identical Breezy days and medal awards when processed twice', async () => {
    const { owner, task } = await createDerivedFixtures()
    await createCompletedEntry(owner.id, task.id)

    await integrationPrisma.$transaction((tx) => enqueueDerivedRefresh(tx, owner.id))
    await processDerivedRefresh(owner.id)
    const firstDays = await integrationPrisma.breezyDay.findMany({
      where: { userId: owner.id },
      orderBy: { date: 'asc' }
    })
    const firstMedals = await integrationPrisma.userMedal.findMany({
      where: { userId: owner.id },
      orderBy: { medalId: 'asc' }
    })

    await integrationPrisma.$transaction((tx) => enqueueDerivedRefresh(tx, owner.id))
    await processDerivedRefresh(owner.id)

    expect(await integrationPrisma.breezyDay.findMany({
      where: { userId: owner.id },
      orderBy: { date: 'asc' }
    })).toEqual(firstDays)
    expect(await integrationPrisma.userMedal.findMany({
      where: { userId: owner.id },
      orderBy: { medalId: 'asc' }
    })).toEqual(firstMedals)
  })

  it('awards break clarity and Sustainable Pace only for persisted pause time', async () => {
    const keep = await createBreakSemanticFixture('keep', false)
    const discard = await createBreakSemanticFixture('discard', false)
    const split = await createBreakSemanticFixture('split', true)
    await integrationPrisma.medal.create({
      data: {
        id: 'sustainable-pace-medal',
        code: 'sustainable-pace',
        name: 'Sustainable Pace',
        description: 'Protected rest or break time.'
      }
    })

    for (const fixture of [keep, discard, split]) {
      await integrationPrisma.$transaction(tx => enqueueDerivedRefresh(tx, fixture.userId))
      expect(await processDerivedRefresh(fixture.userId)).toBe(true)
    }

    const days = await integrationPrisma.breezyDay.findMany({ orderBy: { userId: 'asc' } })
    expect(days.map(day => ({ userId: day.userId, airClarityScore: day.airClarityScore }))).toEqual([
      { userId: discard.userId, airClarityScore: 70 },
      { userId: keep.userId, airClarityScore: 70 },
      { userId: split.userId, airClarityScore: 72 }
    ].sort((left, right) => left.userId.localeCompare(right.userId)))
    expect(await integrationPrisma.userMedal.findMany({ orderBy: { userId: 'asc' } })).toEqual([
      expect.objectContaining({ userId: split.userId, medalId: 'sustainable-pace-medal' })
    ])
  })
})

async function createDerivedFixtures() {
  const owner = await createUser({
    id: 'derived-owner',
    email: 'derived-owner@airgradient.com',
    displayName: 'Derived Owner'
  })
  const task = await createTaskFixture({
    id: 'derived-task',
    ownerId: owner.id
  })
  await integrationPrisma.blocker.create({
    data: { id: 'derived-none', name: 'None' }
  })
  await integrationPrisma.medal.create({
    data: {
      id: 'derived-flow-medal',
      code: 'flow-state',
      name: 'Flow State',
      description: 'Logged a great-flow session.'
    }
  })
  return { owner, task }
}

async function createCompletedEntry(userId: string, taskId: string) {
  return integrationPrisma.timeEntry.create({
    data: {
      id: 'derived-entry',
      userId,
      taskId,
      startedAt: new Date('2026-07-13T09:00:00.000Z'),
      endedAt: new Date('2026-07-13T10:00:00.000Z'),
      durationSeconds: 3_600,
      feedback: {
        create: {
          flowQuality: 'Great flow',
          efficiencyFeel: 'Felt efficient',
          energy: 'High'
        }
      },
      blockers: {
        create: { blockerId: 'derived-none' }
      }
    }
  })
}

async function createBreakSemanticFixture(prefix: string, hasBreak: boolean) {
  const user = await createUser({
    id: `break-${prefix}-user`,
    email: `break-${prefix}@airgradient.com`,
    displayName: `Break ${prefix}`
  })
  const task = await createTaskFixture({ id: `break-${prefix}-task`, ownerId: user.id })
  await integrationPrisma.timeEntry.create({
    data: {
      id: `break-${prefix}-entry`,
      userId: user.id,
      taskId: task.id,
      startedAt: new Date('2026-07-13T09:00:00.000Z'),
      endedAt: new Date('2026-07-13T10:00:00.000Z'),
      durationSeconds: hasBreak ? 3_000 : 3_600,
      idleSeconds: 600,
      excludedIdleSeconds: prefix === 'discard' ? 600 : 0,
      contextSwitches: 0,
      ...(hasBreak
        ? {
            pauses: {
              create: {
                startedAt: new Date('2026-07-13T09:20:00.000Z'),
                endedAt: new Date('2026-07-13T09:30:00.000Z'),
                durationSeconds: 600
              }
            }
          }
        : {})
    }
  })
  return { userId: user.id }
}

async function makeBreezyDaysUnavailable() {
  await integrationPrisma.$executeRawUnsafe(
    'ALTER TABLE "breezy_days" RENAME TO "breezy_days_unavailable"'
  )
}

async function restoreBreezyDays() {
  await integrationPrisma.$executeRawUnsafe(
    'ALTER TABLE "breezy_days_unavailable" RENAME TO "breezy_days"'
  )
}
