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
    await integrationPrisma.settings.create({
      data: {
        userId: fixtures.owner.id,
        locationEnabled: true,
        locationLabels: ['AirGradient office']
      }
    })
    await publicState(fixtures.owner.id)

    const updated = await updateEntry(fixtures.owner.id, fixtures.entry.id, {
      taskId: fixtures.ownerTask.id,
      startedAt: '2026-07-13T11:00:00.000Z',
      endedAt: '2026-07-13T12:00:00.000Z',
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
      idleSeconds: 0,
      contextSwitches: 0,
      durationSeconds: 3_000
    })
    expect(audit).toMatchObject({ userId: fixtures.owner.id, eventType: 'entry_edited' })
    expect(audit?.changes).toMatchObject({ before: expect.any(Object), after: expect.any(Object) })
    expect(exported[0]).toMatchObject({ entry_id: fixtures.entry.id, edited: true, note: 'Edited note' })
  })

  it('preserves server-authoritative idle decisions and context counts during a note edit', async () => {
    const fixtures = await createEditFixtures()
    await publicState(fixtures.owner.id)
    await integrationPrisma.timeEntry.update({
      where: { id: fixtures.entry.id },
      data: {
        durationSeconds: 3_000,
        idleSeconds: 900,
        excludedIdleSeconds: 300,
        contextSwitches: 7,
        pauses: {
          create: {
            startedAt: new Date('2026-07-13T09:30:00.000Z'),
            endedAt: new Date('2026-07-13T09:35:00.000Z'),
            durationSeconds: 300
          }
        },
        idleDecisions: {
          create: [
            idleDecision('keep-idle', 'keep', '2026-07-13T09:10:00.000Z', '2026-07-13T09:15:00.000Z'),
            idleDecision('discard-idle', 'discard', '2026-07-13T09:20:00.000Z', '2026-07-13T09:25:00.000Z'),
            idleDecision('break-idle', 'break', '2026-07-13T09:30:00.000Z', '2026-07-13T09:35:00.000Z')
          ]
        }
      }
    })

    const beforeDecisions = await integrationPrisma.entryIdleDecision.findMany({
      where: { entryId: fixtures.entry.id },
      orderBy: { decisionId: 'asc' }
    })

    const updated = await updateEntry(fixtures.owner.id, fixtures.entry.id, {
      ...validPatch(fixtures.ownerTask.id),
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: '2026-07-13T10:00:00.000Z',
      // A stale or malicious client must not be able to rewrite these values.
      idleSeconds: 999,
      contextSwitches: 999,
      // The split-as-break pause is server-authoritative even if a stale or
      // malicious client omits it from the editable pause list.
      pauses: [],
      feedback: { flowQuality: 'Neutral', efficiencyFeel: 'Felt manual', energy: 'OK', note: 'Note only' }
    })

    expect(updated).toMatchObject({
      idleSeconds: 900,
      excludedIdleSeconds: 300,
      contextSwitches: 7,
      durationSeconds: 3_000,
      feedback: expect.objectContaining({ note: 'Note only' })
    })
    expect(await integrationPrisma.entryIdleDecision.findMany({
      where: { entryId: fixtures.entry.id },
      orderBy: { decisionId: 'asc' }
    })).toEqual(beforeDecisions)
    expect(await integrationPrisma.entryPause.findMany({ where: { entryId: fixtures.entry.id } }))
      .toEqual([expect.objectContaining({
        startedAt: new Date('2026-07-13T09:30:00.000Z'),
        endedAt: new Date('2026-07-13T09:35:00.000Z'),
        durationSeconds: 300
      })])
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
    locationLabel: '',
    pauses: [],
    feedback: { flowQuality: 'Neutral' as const, efficiencyFeel: 'Felt manual' as const, energy: 'OK' as const, note: '' },
    blockers: ['None']
  }
}

function idleDecision(
  decisionId: string,
  decision: 'keep' | 'discard' | 'break',
  startedAt: string,
  endedAt: string
) {
  return {
    decisionId,
    decision,
    startedAt: new Date(startedAt),
    endedAt: new Date(endedAt),
    idleSeconds: 300
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
