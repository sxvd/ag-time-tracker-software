import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { publicState, stopEntry } from '../../backend/utils/store'
import { recordIdleDecision } from '../../backend/utils/timer-activity'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('persisted idle decisions', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('enforces entry ownership and idle interval bounds', async () => {
    const { owner, other, entry, startedAt } = await createIdleFixtures()

    await expect(recordIdleDecision(other.id, entry.id, idleInput(
      'ownership-check',
      'keep',
      offset(startedAt, 600),
      offset(startedAt, 900)
    ))).rejects.toMatchObject({ statusCode: 404 })

    await expect(recordIdleDecision(owner.id, entry.id, idleInput(
      'before-entry',
      'keep',
      offset(startedAt, -600),
      offset(startedAt, 300)
    ))).rejects.toMatchObject({ statusCode: 400 })

    await integrationPrisma.timeEntry.update({
      where: { id: entry.id },
      data: { startedAt: new Date(Date.now() - 26 * 60 * 60 * 1_000) }
    })
    await expect(recordIdleDecision(owner.id, entry.id, {
      decisionId: 'too-long',
      decision: 'discard',
      startedAt: new Date(Date.now() - 25 * 60 * 60 * 1_000).toISOString(),
      endedAt: new Date().toISOString()
    })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('persists keep and discard totals and reconciles an identical retry', async () => {
    const { owner, entry, startedAt } = await createIdleFixtures()
    const keep = idleInput(
      'keep-once',
      'keep',
      offset(startedAt, 600),
      offset(startedAt, 900)
    )

    await recordIdleDecision(owner.id, entry.id, keep)
    const retried = await recordIdleDecision(owner.id, entry.id, keep)
    await recordIdleDecision(owner.id, entry.id, idleInput(
      'discard-once',
      'discard',
      offset(startedAt, 1_200),
      offset(startedAt, 1_500)
    ))

    expect(await integrationPrisma.timeEntry.findUniqueOrThrow({
      where: { id: entry.id }
    })).toMatchObject({
      idleSeconds: 600,
      excludedIdleSeconds: 300
    })
    expect(await integrationPrisma.entryIdleDecision.count({
      where: { entryId: entry.id }
    })).toBe(2)
    expect(retried.idleSeconds).toBe(300)
  })

  it('rejects new idle data after activity tracking is disabled', async () => {
    const { owner, entry, startedAt } = await createIdleFixtures()
    await integrationPrisma.settings.create({
      data: {
        userId: owner.id,
        idleThresholdMinutes: 5,
        nudgeCadenceMinutes: 50,
        breezyVerbosity: 'gentle',
        muted: false,
        locationEnabled: false,
        activityEnabled: false,
        locationLabels: []
      }
    })

    await expect(recordIdleDecision(owner.id, entry.id, idleInput(
      'disabled-activity',
      'discard',
      offset(startedAt, 600),
      offset(startedAt, 900)
    ))).rejects.toMatchObject({ statusCode: 409 })
    expect(await integrationPrisma.entryIdleDecision.count()).toBe(0)
  })

  it('rejects the same idle interval under a different decision ID', async () => {
    const { owner, entry, startedAt } = await createIdleFixtures()
    await recordIdleDecision(owner.id, entry.id, idleInput(
      'first-tab',
      'keep',
      offset(startedAt, 600),
      offset(startedAt, 900)
    ))

    await expect(recordIdleDecision(owner.id, entry.id, idleInput(
      'second-tab',
      'discard',
      offset(startedAt, 650),
      offset(startedAt, 850)
    ))).rejects.toMatchObject({ statusCode: 409 })
    expect(await integrationPrisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } }))
      .toMatchObject({ idleSeconds: 300, excludedIdleSeconds: 0 })
  })

  it('persists a break as total idle time and one closed pause', async () => {
    const { owner, entry, startedAt } = await createIdleFixtures()
    await recordIdleDecision(owner.id, entry.id, idleInput(
      'split-break',
      'break',
      offset(startedAt, 600),
      offset(startedAt, 900)
    ))

    const saved = await integrationPrisma.timeEntry.findUniqueOrThrow({
      where: { id: entry.id },
      include: { pauses: true }
    })
    expect(saved).toMatchObject({
      idleSeconds: 300,
      excludedIdleSeconds: 0
    })
    expect(saved.pauses).toEqual([
      expect.objectContaining({
        startedAt: offset(startedAt, 600),
        endedAt: offset(startedAt, 900),
        durationSeconds: 300
      })
    ])
  })

  it('restores idle totals through bootstrap and uses only excluded idle at stop', async () => {
    const { owner, entry, startedAt } = await createIdleFixtures()
    await integrationPrisma.blocker.create({
      data: { id: 'idle-none', name: 'None' }
    })
    await recordIdleDecision(owner.id, entry.id, idleInput(
      'kept-idle',
      'keep',
      offset(startedAt, 300),
      offset(startedAt, 600)
    ))
    await recordIdleDecision(owner.id, entry.id, idleInput(
      'discarded-idle',
      'discard',
      offset(startedAt, 900),
      offset(startedAt, 1_200)
    ))
    await recordIdleDecision(owner.id, entry.id, idleInput(
      'idle-break',
      'break',
      offset(startedAt, 1_500),
      offset(startedAt, 1_800)
    ))

    const restored = await publicState(owner.id)
    expect(restored.entries.find((candidate) => candidate.id === entry.id))
      .toMatchObject({
        idleSeconds: 900,
        excludedIdleSeconds: 300,
        pauses: [expect.objectContaining({ durationSeconds: 300 })]
      })

    const stopped = await stopEntry({
      entryId: entry.id,
      userId: owner.id,
      blockers: ['None']
    })
    expect(stopped.idleSeconds).toBe(900)
    expect(stopped.excludedIdleSeconds).toBe(300)
    expect(stopped.durationSeconds).toBeGreaterThanOrEqual(3_000)
    expect(stopped.durationSeconds).toBeLessThanOrEqual(3_010)
  })
})

async function createIdleFixtures() {
  const owner = await createUser({
    id: 'idle-owner',
    email: 'idle-owner@airgradient.com',
    displayName: 'Idle Owner'
  })
  const other = await createUser({
    id: 'idle-other',
    email: 'idle-other@airgradient.com',
    displayName: 'Idle Other'
  })
  const task = await createTaskFixture({
    id: 'idle-task',
    ownerId: owner.id
  })
  const entry = await createEntryFixture({
    id: 'idle-entry',
    userId: owner.id,
    taskId: task.id,
    active: true
  })
  const startedAt = new Date(Date.now() - 60 * 60 * 1_000)
  await integrationPrisma.timeEntry.update({
    where: { id: entry.id },
    data: { startedAt }
  })
  return { owner, other, task, entry, startedAt }
}

function offset(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1_000)
}

function idleInput(
  decisionId: string,
  decision: 'keep' | 'discard' | 'break',
  startedAt: Date,
  endedAt: Date
) {
  return {
    decisionId,
    decision,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString()
  }
}
