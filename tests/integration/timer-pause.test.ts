import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { pauseActiveEntry, resumeActiveEntry } from '../../backend/utils/timer-activity'
import { publicState, stopEntry } from '../../backend/utils/store'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('persisted timer pause lifecycle', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('persists one open pause and enforces entry ownership through resume', async () => {
    const owner = await createUser({ id: 'pause-owner', email: 'pause-owner@airgradient.com', displayName: 'Pause Owner' })
    const other = await createUser({ id: 'pause-other', email: 'pause-other@airgradient.com', displayName: 'Pause Other' })
    const task = await createTaskFixture({ id: 'pause-task', ownerId: owner.id })
    const entry = await createEntryFixture({ id: 'pause-entry', userId: owner.id, taskId: task.id, active: true })

    await pauseActiveEntry(owner.id, entry.id)
    await expect(pauseActiveEntry(owner.id, entry.id)).rejects.toMatchObject({ statusCode: 409 })

    const stateWhilePaused = await publicState(owner.id)
    expect(stateWhilePaused.entries.find((row) => row.id === entry.id)?.pauses).toContainEqual(
      expect.objectContaining({ endedAt: null })
    )

    await expect(resumeActiveEntry(other.id, entry.id)).rejects.toMatchObject({ statusCode: 404 })
    await resumeActiveEntry(owner.id, entry.id)
    await expect(resumeActiveEntry(owner.id, entry.id)).rejects.toMatchObject({ statusCode: 409 })

    const savedPause = await integrationPrisma.entryPause.findFirstOrThrow({ where: { entryId: entry.id } })
    expect(savedPause.endedAt).not.toBeNull()
    expect(savedPause.durationSeconds).toBeGreaterThanOrEqual(0)
  })

  it('keeps one open pause when pause requests race', async () => {
    const owner = await createUser({ id: 'race-owner', email: 'race-owner@airgradient.com', displayName: 'Race Owner' })
    const task = await createTaskFixture({ id: 'race-task', ownerId: owner.id })
    const entry = await createEntryFixture({ id: 'race-entry', userId: owner.id, taskId: task.id, active: true })

    const results = await Promise.allSettled([
      pauseActiveEntry(owner.id, entry.id),
      pauseActiveEntry(owner.id, entry.id)
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await integrationPrisma.entryPause.count({ where: { entryId: entry.id, endedAt: null } })).toBe(1)
  })

  it('closes an open pause on stop and excludes it from tracked duration', async () => {
    const owner = await createUser({ id: 'stop-owner', email: 'stop-owner@airgradient.com', displayName: 'Stop Owner' })
    const task = await createTaskFixture({ id: 'stop-task', ownerId: owner.id })
    const entry = await createEntryFixture({ id: 'stop-entry', userId: owner.id, taskId: task.id, active: true })
    await integrationPrisma.blocker.create({ data: { id: 'none-blocker', name: 'None' } })
    const startedAt = new Date(Date.now() - 60 * 60 * 1000)
    await integrationPrisma.timeEntry.update({ where: { id: entry.id }, data: { startedAt } })

    await pauseActiveEntry(owner.id, entry.id)
    await integrationPrisma.entryPause.updateMany({
      where: { entryId: entry.id, endedAt: null },
      data: { startedAt: new Date(Date.now() - 10 * 60 * 1000) }
    })

    const stopInput: Parameters<typeof stopEntry>[0] & { pauses: Array<{ startedAt: string, endedAt: string }> } = {
      entryId: entry.id,
      userId: owner.id,
      idleSeconds: 0,
      contextSwitches: 0,
      pauses: [{ startedAt: startedAt.toISOString(), endedAt: new Date().toISOString() }],
      feedback: { flowQuality: 'Neutral', efficiencyFeel: 'Felt efficient', energy: 'OK', note: '' },
      blockers: ['None']
    }
    const stopped = await stopEntry(stopInput)

    const savedPauses = await integrationPrisma.entryPause.findMany({ where: { entryId: entry.id } })
    expect(savedPauses).toHaveLength(1)
    expect(savedPauses[0].endedAt).not.toBeNull()
    expect(savedPauses[0].durationSeconds).toBeGreaterThanOrEqual(590)
    expect(stopped.durationSeconds).toBeGreaterThanOrEqual(2_990)
    expect(stopped.durationSeconds).toBeLessThanOrEqual(3_010)
  })
})
