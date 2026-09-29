import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordContextSwitch } from '../../backend/utils/timer-activity'
import { publicState, stopEntry } from '../../backend/utils/store'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('server-authoritative context-switch persistence', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('increments an owned active entry atomically', async () => {
    const { owner, entry } = await createContextSwitchFixtures()

    expect(await recordContextSwitch(owner.id, entry.id)).toBe(1)
    await Promise.all([
      recordContextSwitch(owner.id, entry.id),
      recordContextSwitch(owner.id, entry.id)
    ])

    const saved = await integrationPrisma.timeEntry.findUniqueOrThrow({
      where: { id: entry.id }
    })
    expect(saved.contextSwitches).toBe(3)
  })

  it('rejects another users entry and a completed entry', async () => {
    const { owner, other, task, entry } = await createContextSwitchFixtures()
    const completed = await createEntryFixture({
      id: 'completed-context-entry',
      userId: owner.id,
      taskId: task.id
    })

    await expect(recordContextSwitch(other.id, entry.id))
      .rejects.toMatchObject({ statusCode: 404 })
    await expect(recordContextSwitch(owner.id, completed.id))
      .rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects increments when activity tracking is disabled', async () => {
    const { owner, entry } = await createContextSwitchFixtures({ activityEnabled: false })

    await expect(recordContextSwitch(owner.id, entry.id))
      .rejects.toMatchObject({ statusCode: 409 })
    expect((await integrationPrisma.timeEntry.findUniqueOrThrow({
      where: { id: entry.id }
    })).contextSwitches).toBe(0)
  })

  it('rejects increments while the active entry is paused', async () => {
    const { owner, entry } = await createContextSwitchFixtures()
    await integrationPrisma.entryPause.create({
      data: {
        entryId: entry.id,
        startedAt: new Date('2026-07-13T09:30:00.000Z')
      }
    })

    await expect(recordContextSwitch(owner.id, entry.id))
      .rejects.toMatchObject({ statusCode: 409 })
    expect((await integrationPrisma.timeEntry.findUniqueOrThrow({
      where: { id: entry.id }
    })).contextSwitches).toBe(0)
  })

  it('restores the persisted count through bootstrap state', async () => {
    const { owner, entry } = await createContextSwitchFixtures()
    await recordContextSwitch(owner.id, entry.id)
    await recordContextSwitch(owner.id, entry.id)

    const state = await publicState(owner.id)

    expect(state.entries.find((row) => row.id === entry.id)?.contextSwitches).toBe(2)
  })

  it('preserves the database count when a stop payload forges zero', async () => {
    const { owner, entry } = await createContextSwitchFixtures()
    await recordContextSwitch(owner.id, entry.id)
    await recordContextSwitch(owner.id, entry.id)
    await publicState(owner.id)

    const forgedStopInput = {
      entryId: entry.id,
      userId: owner.id,
      idleSeconds: 0,
      contextSwitches: 0,
      feedback: {
        flowQuality: 'Neutral' as const,
        efficiencyFeel: 'Felt efficient' as const,
        energy: 'OK' as const,
        note: ''
      },
      blockers: ['None']
    }
    const stopped = await stopEntry(forgedStopInput)
    const saved = await integrationPrisma.timeEntry.findUniqueOrThrow({
      where: { id: entry.id }
    })

    expect(stopped.contextSwitches).toBe(2)
    expect(saved.contextSwitches).toBe(2)
  })
})

async function createContextSwitchFixtures(options: { activityEnabled?: boolean } = {}) {
  const owner = await createUser({
    id: 'context-owner',
    email: 'context-owner@airgradient.com',
    displayName: 'Context Owner'
  })
  const other = await createUser({
    id: 'context-other',
    email: 'context-other@airgradient.com',
    displayName: 'Context Other'
  })
  const task = await createTaskFixture({
    id: 'context-task',
    ownerId: owner.id
  })
  const entry = await createEntryFixture({
    id: 'active-context-entry',
    userId: owner.id,
    taskId: task.id,
    active: true
  })
  await integrationPrisma.settings.create({
    data: {
      userId: owner.id,
      activityEnabled: options.activityEnabled ?? true,
      locationLabels: []
    }
  })
  return { owner, other, task, entry }
}
