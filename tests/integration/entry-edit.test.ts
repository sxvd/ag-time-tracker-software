import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportRows, publicState, updateEntry } from '../../backend/utils/store'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('owned completed-entry editing', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('edits an owned entry, flags it, audits it, and exports the result', async () => {
    const fixtures = await createEditFixtures()
    await publicState(fixtures.owner.id)

    const updated = await updateEntry(fixtures.owner.id, fixtures.entry.id, {
      taskId: fixtures.ownerTask.id,
      startedAt: '2026-07-13T11:00:00.000Z',
      endedAt: '2026-07-13T12:00:00.000Z',
      idleSeconds: 60,
      contextSwitches: 3,
      locationLabel: 'AirGradient office',
      pauses: [{ startedAt: '2026-07-13T11:20:00.000Z', endedAt: '2026-07-13T11:30:00.000Z' }],
      feedback: { flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High', note: 'Edited note' },
      blockers: ['None']
    })

    const audit = await integrationPrisma.entryAuditEvent.findFirst({ where: { entryId: fixtures.entry.id } })
    const exported = await exportRows(fixtures.owner.id)

    expect(updated).toMatchObject({
      id: fixtures.entry.id,
      isEdited: true,
      idleSeconds: 60,
      contextSwitches: 3,
      durationSeconds: 2_940
    })
    expect(audit).toMatchObject({ userId: fixtures.owner.id, eventType: 'entry_edited' })
    expect(audit?.changes).toMatchObject({ before: expect.any(Object), after: expect.any(Object) })
    expect(exported[0]).toMatchObject({ entry_id: fixtures.entry.id, edited: true, note: 'Edited note' })
  })

  it('does not edit another users entry or move an entry to an inaccessible task', async () => {
    const fixtures = await createEditFixtures()

    await expect(updateEntry(fixtures.other.id, fixtures.entry.id, validPatch(fixtures.ownerTask.id)))
      .rejects.toMatchObject({ statusCode: 404 })
    await expect(updateEntry(fixtures.owner.id, fixtures.entry.id, validPatch(fixtures.otherTask.id)))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('rejects edits that overlap another entry', async () => {
    const fixtures = await createEditFixtures()
    await integrationPrisma.timeEntry.create({
      data: {
        id: 'later-entry',
        userId: fixtures.owner.id,
        taskId: fixtures.ownerTask.id,
        startedAt: new Date('2026-07-13T12:00:00.000Z'),
        endedAt: new Date('2026-07-13T13:00:00.000Z'),
        durationSeconds: 3_600
      }
    })

    await expect(updateEntry(fixtures.owner.id, fixtures.entry.id, {
      ...validPatch(fixtures.ownerTask.id),
      startedAt: '2026-07-13T12:30:00.000Z',
      endedAt: '2026-07-13T13:30:00.000Z'
    })).rejects.toMatchObject({ statusCode: 409 })
  })
})

function validPatch(taskId: string) {
  return {
    taskId,
    startedAt: '2026-07-13T11:00:00.000Z',
    endedAt: '2026-07-13T12:00:00.000Z',
    idleSeconds: 0,
    contextSwitches: 0,
    locationLabel: '',
    pauses: [],
    feedback: { flowQuality: 'Neutral' as const, efficiencyFeel: 'Felt manual' as const, energy: 'OK' as const, note: '' },
    blockers: ['None']
  }
}

async function createEditFixtures() {
  const owner = await createUser({ id: 'edit-owner', email: 'edit-owner@airgradient.com', displayName: 'Edit Owner' })
  const other = await createUser({ id: 'edit-other', email: 'edit-other@airgradient.com', displayName: 'Edit Other' })
  const ownerTask = await createTaskFixture({ id: 'edit-owner-task', ownerId: owner.id })
  const otherTask = await createTaskFixture({ id: 'edit-other-task', ownerId: other.id })
  const entry = await createEntryFixture({ id: 'editable-entry', userId: owner.id, taskId: ownerTask.id })
  return { owner, other, ownerTask, otherTask, entry }
}
