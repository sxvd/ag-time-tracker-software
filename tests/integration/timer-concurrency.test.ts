import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateDuration } from '../../shared/utils/time'
import { startEntry, stopEntry } from '../../backend/utils/store'
import { pauseActiveEntry, recordIdleDecision } from '../../backend/utils/timer-activity'
import {
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('active timer database constraint', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('allows only one active entry when start requests race', async () => {
    const user = await createUser({ id: 'timer-user', email: 'timer@airgradient.com', displayName: 'Timer User' })
    const task = await createTaskFixture({ id: 'timer-task', ownerId: user.id })

    const results = await Promise.allSettled([
      startEntry({ taskId: task.id, userId: user.id }),
      startEntry({ taskId: task.id, userId: user.id })
    ])

    const activeEntries = await integrationPrisma.timeEntry.findMany({
      where: { userId: user.id, endedAt: null }
    })
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    expect(activeEntries).toHaveLength(1)
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 })
  })

  it('rejects a second active row even when application preflight is bypassed', async () => {
    const user = await createUser({ id: 'constraint-user', email: 'constraint@airgradient.com', displayName: 'Constraint User' })
    const task = await createTaskFixture({ id: 'constraint-task', ownerId: user.id })
    await integrationPrisma.timeEntry.create({
      data: {
        id: 'active-one',
        userId: user.id,
        taskId: task.id,
        startedAt: new Date(),
        durationSeconds: 0
      }
    })

    await expect(integrationPrisma.timeEntry.create({
      data: {
        id: 'active-two',
        userId: user.id,
        taskId: task.id,
        startedAt: new Date(),
        durationSeconds: 0
      }
    })).rejects.toMatchObject({ code: 'P2002' })
  })

  it('serializes racing stop and pause requests without leaving an open pause', async () => {
    await integrationPrisma.blocker.create({ data: { id: 'race-none', name: 'None' } })
    const fixtures = await createRaceFixtures('pause', 4)

    await Promise.all(fixtures.map(async ({ userId, entryId }) => {
      await Promise.allSettled([
        stopEntry({ entryId, userId, blockers: ['None'] }),
        pauseActiveEntry(userId, entryId)
      ])
    }))

    for (const { entryId } of fixtures) {
      const saved = await integrationPrisma.timeEntry.findUniqueOrThrow({
        where: { id: entryId },
        include: { pauses: true }
      })
      expect(saved.endedAt).toBeInstanceOf(Date)
      expect(saved.pauses.some(pause => pause.endedAt === null)).toBe(false)
      expect(saved.durationSeconds).toBe(calculateDuration(
        saved.startedAt.toISOString(),
        saved.endedAt!.toISOString(),
        saved.pauses.map(pause => ({
          startedAt: pause.startedAt.toISOString(),
          endedAt: pause.endedAt!.toISOString()
        })),
        saved.excludedIdleSeconds
      ))
    }
  })

  it('serializes racing stop and idle requests with duration from the locked final state', async () => {
    await integrationPrisma.blocker.create({ data: { id: 'idle-race-none', name: 'None' } })
    const fixtures = await createRaceFixtures('idle', 4)

    await Promise.all(fixtures.map(async ({ userId, entryId, startedAt }, index) => {
      await Promise.allSettled([
        stopEntry({ entryId, userId, blockers: ['None'] }),
        recordIdleDecision(userId, entryId, {
          decisionId: `idle-race-${index}`,
          decision: 'discard',
          startedAt: new Date(startedAt.getTime() + 600_000).toISOString(),
          endedAt: new Date(startedAt.getTime() + 900_000).toISOString()
        })
      ])
    }))

    for (const { entryId } of fixtures) {
      const saved = await integrationPrisma.timeEntry.findUniqueOrThrow({
        where: { id: entryId },
        include: { pauses: true }
      })
      expect(saved.endedAt).toBeInstanceOf(Date)
      expect(saved.durationSeconds).toBe(calculateDuration(
        saved.startedAt.toISOString(),
        saved.endedAt!.toISOString(),
        saved.pauses.map(pause => ({
          startedAt: pause.startedAt.toISOString(),
          endedAt: pause.endedAt!.toISOString()
        })),
        saved.excludedIdleSeconds
      ))
    }
  })
})

async function createRaceFixtures(prefix: string, count: number) {
  const fixtures: Array<{ userId: string, entryId: string, startedAt: Date }> = []
  for (let index = 0; index < count; index += 1) {
    const user = await createUser({
      id: `${prefix}-race-user-${index}`,
      email: `${prefix}-race-${index}@airgradient.com`,
      displayName: `${prefix} Race ${index}`
    })
    const task = await createTaskFixture({ id: `${prefix}-race-task-${index}`, ownerId: user.id })
    const entry = await startEntry({ taskId: task.id, userId: user.id })
    const startedAt = new Date(Date.now() - 3_600_000)
    await integrationPrisma.timeEntry.update({ where: { id: entry.id }, data: { startedAt } })
    fixtures.push({ userId: user.id, entryId: entry.id, startedAt })
  }
  return fixtures
}
