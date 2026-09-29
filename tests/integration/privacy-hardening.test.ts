import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCompanyDashboard, createManualEntry, exportData, exportRows, publicState, startEntry, updateEntry } from '../../backend/utils/store'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('consent-aware entry location', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('does not persist or export a requested location while location tracking is disabled', async () => {
    const { user, task } = await createLocationFixtures(false)

    const started = await startEntry({
      taskId: task.id,
      userId: user.id,
      locationLabel: 'Home office'
    })
    await completeEntry(started.id)

    expect(await integrationPrisma.timeEntry.findUniqueOrThrow({ where: { id: started.id } }))
      .toMatchObject({ locationLabel: null })
    expect(await exportRows(user.id)).toEqual([
      expect.objectContaining({ entry_id: started.id, location_label: '' })
    ])
  })

  it('persists only an explicitly selected allowed label while location tracking is enabled', async () => {
    const { user, task } = await createLocationFixtures(true)

    const started = await startEntry({
      taskId: task.id,
      userId: user.id,
      locationLabel: 'AirGradient office'
    })
    expect(started.locationLabel).toBe('AirGradient office')

    await integrationPrisma.timeEntry.update({
      where: { id: started.id },
      data: { endedAt: new Date(), durationSeconds: 1 }
    })
    await expect(startEntry({
      taskId: task.id,
      userId: user.id,
      locationLabel: 'Unapproved location'
    })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('applies the same consent boundary to manual creation and location edits', async () => {
    const { user, task } = await createLocationFixtures(false)
    await publicState(user.id)
    const manual = await createManualEntry({
      taskId: task.id,
      userId: user.id,
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: '2026-07-13T10:00:00.000Z',
      locationLabel: 'Home office',
      blockers: ['None']
    })
    expect(manual.locationLabel).toBe('')

    await integrationPrisma.timeEntry.update({ where: { id: manual.id }, data: { locationLabel: 'Historical label' } })
    const preserved = await updateEntry(user.id, manual.id, {
      taskId: task.id,
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: '2026-07-13T10:00:00.000Z',
      locationLabel: 'Historical label',
      pauses: [],
      blockers: ['None']
    })
    expect(preserved.locationLabel).toBe('Historical label')

    await expect(updateEntry(user.id, manual.id, {
      taskId: task.id,
      startedAt: '2026-07-13T09:00:00.000Z',
      endedAt: '2026-07-13T10:00:00.000Z',
      locationLabel: 'New location without consent',
      pauses: [],
      blockers: ['None']
    })).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('raw-export identity isolation', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('keeps downloaded rows and export audit records scoped to the initiating user', async () => {
    const first = await createUser({ id: 'export-first', email: 'first@airgradient.com', displayName: 'First' })
    const second = await createUser({ id: 'export-second', email: 'second@airgradient.com', displayName: 'Second' })
    const firstTask = await createTaskFixture({ id: 'export-first-task', ownerId: first.id, title: 'First private task' })
    const secondTask = await createTaskFixture({ id: 'export-second-task', ownerId: second.id, title: 'Second private task' })
    await createEntryFixture({ id: 'export-first-entry', userId: first.id, taskId: firstTask.id })
    await createEntryFixture({ id: 'export-second-entry', userId: second.id, taskId: secondTask.id })

    const firstDownload = JSON.parse(await exportData(first.id, 'json'))
    const secondDownload = JSON.parse(await exportData(second.id, 'json'))

    expect(firstDownload).toEqual([expect.objectContaining({ entry_id: 'export-first-entry', task: 'First private task' })])
    expect(JSON.stringify(firstDownload)).not.toContain('Second private task')
    expect(secondDownload).toEqual([expect.objectContaining({ entry_id: 'export-second-entry', task: 'Second private task' })])
    expect(JSON.stringify(secondDownload)).not.toContain('First private task')
    expect(await integrationPrisma.export.findMany({ orderBy: { userId: 'asc' } })).toEqual([
      expect.objectContaining({ userId: first.id, format: 'json' }),
      expect.objectContaining({ userId: second.id, format: 'json' })
    ])
  })
})

describe('shared-task and company privacy DTOs', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('keeps detailed entries owner-only and exposes a reduced effort summary only to task members', async () => {
    const owner = await createUser({ id: 'privacy-owner', email: 'privacy-owner@airgradient.com', displayName: 'Privacy Owner' })
    const member = await createUser({ id: 'privacy-member', email: 'privacy-member@airgradient.com', displayName: 'Privacy Member' })
    const unrelated = await createUser({ id: 'privacy-unrelated', email: 'privacy-unrelated@airgradient.com', displayName: 'Privacy Unrelated' })
    const task = await createTaskFixture({ id: 'privacy-shared-task', ownerId: owner.id, memberIds: [member.id] })
    await integrationPrisma.blocker.create({ data: { id: 'privacy-blocker', name: 'Unclear requirements' } })
    await integrationPrisma.timeEntry.create({
      data: {
        id: 'privacy-owner-entry',
        userId: owner.id,
        taskId: task.id,
        startedAt: new Date('2026-07-13T09:00:00.000Z'),
        endedAt: new Date('2026-07-13T10:00:00.000Z'),
        durationSeconds: 3_300,
        idleSeconds: 300,
        contextSwitches: 4,
        locationLabel: 'Private home',
        pauses: { create: { startedAt: new Date('2026-07-13T09:20:00.000Z'), endedAt: new Date('2026-07-13T09:25:00.000Z'), durationSeconds: 300 } },
        feedback: { create: { flowQuality: 'Friction', efficiencyFeel: 'Felt manual', energy: 'OK', note: 'Private note' } },
        blockers: { create: { blockerId: 'privacy-blocker' } }
      }
    })

    const ownerState = await publicState(owner.id)
    const memberState = await publicState(member.id)
    const unrelatedState = await publicState(unrelated.id)

    expect(ownerState.entries).toContainEqual(expect.objectContaining({ id: 'privacy-owner-entry', feedback: expect.objectContaining({ note: 'Private note' }) }))
    expect(memberState.entries).not.toContainEqual(expect.objectContaining({ id: 'privacy-owner-entry' }))
    expect(memberState.sharedTaskEffort).toEqual([
      expect.objectContaining({
        taskId: task.id,
        myDurationSeconds: 0,
        members: expect.arrayContaining([
          expect.objectContaining({ userId: owner.id, displayName: owner.displayName, role: 'owner' }),
          expect.objectContaining({ userId: member.id, displayName: member.displayName, role: 'member' })
        ])
      })
    ])
    const sharedSummaryJson = JSON.stringify(memberState.sharedTaskEffort)
    expect(sharedSummaryJson).not.toMatch(/Private note|Private home|startedAt|pauses|blockers|3300/i)
    expect(sharedSummaryJson).not.toContain('totalSeconds')
    expect(sharedSummaryJson).not.toContain('contributors')
    expect(sharedSummaryJson).not.toContain('"durationSeconds":')
    expect(unrelatedState.sharedTaskEffort).toEqual([])
  })

  it('returns aggregate active shared-task counts without names and honors the category filter', async () => {
    const owner = await createUser({ id: 'presence-owner', email: 'presence-owner@airgradient.com', displayName: 'Named Owner', team: 'Software' })
    const member = await createUser({ id: 'presence-member', email: 'presence-member@airgradient.com', displayName: 'Named Member', team: 'Hardware' })
    const viewer = await createUser({ id: 'presence-viewer', email: 'presence-viewer@airgradient.com', displayName: 'Viewer', team: 'Communication' })
    const task = await createTaskFixture({ id: 'presence-task', ownerId: owner.id, title: 'Shared QA', memberIds: [member.id] })
    const ownerEntry = await createEntryFixture({ id: 'presence-owner-entry', userId: owner.id, taskId: task.id, active: true })
    const memberEntry = await createEntryFixture({ id: 'presence-member-entry', userId: member.id, taskId: task.id, active: true })
    await createEntryFixture({ id: 'presence-owner-finished', userId: owner.id, taskId: task.id, contextSwitches: 2 })
    await createEntryFixture({ id: 'presence-member-finished', userId: member.id, taskId: task.id, contextSwitches: 4 })
    await integrationPrisma.trackingPresence.createMany({
      data: [
        { userId: owner.id, taskId: task.id, entryId: ownerEntry.id, startedAt: ownerEntry.startedAt },
        { userId: member.id, taskId: task.id, entryId: memberEntry.id, startedAt: memberEntry.startedAt }
      ]
    })

    const all = await buildCompanyDashboard({
      weekStart: new Date('2026-07-13T00:00:00.000Z'),
      metric: 'contextSwitches',
      groupBy: 'category'
    })
    const category = await buildCompanyDashboard({
      categoryId: task.categoryId,
      weekStart: new Date('2026-07-13T00:00:00.000Z'),
      metric: 'contextSwitches',
      groupBy: 'category'
    })

    expect(all.activeSharedSessionCount).toBe(2)
    expect(category.activeSharedSessionCount).toBe(2)
    expect(all.overview.days[0]?.series).toEqual([{ name: 'Test category', value: 6 }])
    expect(JSON.stringify(all)).not.toMatch(/Shared QA|Named Owner|Named Member|userId|displayName|Private home|taskId|entryId/i)
    await expect(buildCompanyDashboard({
      categoryId: 'unknown-category',
      metric: 'trackedTime',
      groupBy: 'category'
    })).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Select an available category.'
    })
  })
})

async function createLocationFixtures(locationEnabled: boolean) {
  const user = await createUser({ id: `location-${locationEnabled}`, email: `location-${locationEnabled}@airgradient.com`, displayName: 'Location User' })
  const task = await createTaskFixture({ id: `location-task-${locationEnabled}`, ownerId: user.id })
  await integrationPrisma.settings.create({
    data: {
      userId: user.id,
      idleThresholdMinutes: 5,
      nudgeCadenceMinutes: 50,
      breezyVerbosity: 'gentle',
      muted: false,
      activityEnabled: true,
      locationEnabled,
      locationLabels: ['Home office', 'AirGradient office']
    }
  })
  return { user, task }
}

async function completeEntry(entryId: string) {
  await integrationPrisma.timeEntry.update({
    where: { id: entryId },
    data: { endedAt: new Date(), durationSeconds: 1 }
  })
}
