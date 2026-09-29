import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { acknowledgeBreezyNudge, claimDueBreezyNudge, nudgeMessages } from '../../backend/utils/breezy-nudges'
import { publicState } from '../../backend/utils/store'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('persisted Breezy nudges', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('hides another user entry as not found and creates nothing', async () => {
    const { owner, other, entry, now } = await createNudgeFixtures(60)

    await expect(claimDueBreezyNudge(other.id, entry.id, now)).rejects.toMatchObject({ statusCode: 404 })
    expect(await integrationPrisma.breezyNudge.count()).toBe(0)
  })

  it('does not claim for completed or currently paused entries', async () => {
    const completed = await createNudgeFixtures(60, { prefix: 'completed', active: false })
    await expect(claimDueBreezyNudge(completed.owner.id, completed.entry.id, completed.now)).resolves.toBeNull()

    const paused = await createNudgeFixtures(60, { prefix: 'paused' })
    await integrationPrisma.entryPause.create({
      data: { entryId: paused.entry.id, startedAt: new Date(paused.now.getTime() - 60_000) }
    })
    await expect(claimDueBreezyNudge(paused.owner.id, paused.entry.id, paused.now)).resolves.toBeNull()
    expect(await integrationPrisma.breezyNudge.count()).toBe(0)
  })

  it.each([
    { muted: true, breezyVerbosity: 'gentle' },
    { muted: false, breezyVerbosity: 'quiet' }
  ])('does not claim when settings are $breezyVerbosity and muted=$muted', async (settings) => {
    const fixture = await createNudgeFixtures(60, { prefix: `settings-${settings.breezyVerbosity}-${settings.muted}` })
    await createSettings(fixture.owner.id, settings)

    await expect(claimDueBreezyNudge(fixture.owner.id, fixture.entry.id, fixture.now)).resolves.toBeNull()
    expect(await integrationPrisma.breezyNudge.count()).toBe(0)
  })

  it('creates long focus only after 45 working minutes using locked server data', async () => {
    const early = await createNudgeFixtures(44, { prefix: 'early' })
    await expect(claimDueBreezyNudge(early.owner.id, early.entry.id, early.now)).resolves.toBeNull()

    const due = await createNudgeFixtures(45, { prefix: 'due' })
    await expect(claimDueBreezyNudge(due.owner.id, due.entry.id, due.now)).resolves.toMatchObject({
      relatedEntryId: due.entry.id,
      type: 'long-focus',
      message: nudgeMessages['long-focus'],
      shownAt: due.now.toISOString(),
      acknowledgedAt: null
    })
    expect(await integrationPrisma.breezyNudge.count({ where: { relatedEntryId: due.entry.id } })).toBe(1)
  })

  it('returns one effective nudge when simultaneous claims race', async () => {
    const { owner, entry, now } = await createNudgeFixtures(45, { prefix: 'race' })

    const [first, second] = await Promise.all([
      claimDueBreezyNudge(owner.id, entry.id, now),
      claimDueBreezyNudge(owner.id, entry.id, now)
    ])

    expect(first?.id).toBe(second?.id)
    expect(await integrationPrisma.breezyNudge.count({ where: { relatedEntryId: entry.id } })).toBe(1)
  })

  it('alternates hydration then ventilation by cadence without counting pauses or excluded idle', async () => {
    const fixture = await createNudgeFixtures(210, { prefix: 'cadence' })
    await createSettings(fixture.owner.id, { nudgeCadenceMinutes: 60 })
    await integrationPrisma.entryPause.create({
      data: {
        entryId: fixture.entry.id,
        startedAt: new Date(fixture.now.getTime() - 120 * 60_000),
        endedAt: new Date(fixture.now.getTime() - 90 * 60_000),
        durationSeconds: 1_800
      }
    })
    await integrationPrisma.timeEntry.update({
      where: { id: fixture.entry.id },
      data: { excludedIdleSeconds: 30 * 60 }
    })

    const longFocus = await claimDueBreezyNudge(fixture.owner.id, fixture.entry.id, fixture.now)
    expect(longFocus?.type).toBe('long-focus')
    await acknowledgeBreezyNudge(fixture.owner.id, longFocus!.id, fixture.now)

    const hydration = await claimDueBreezyNudge(fixture.owner.id, fixture.entry.id, fixture.now)
    expect(hydration).toMatchObject({ type: 'hydration', message: nudgeMessages.hydration })
    await acknowledgeBreezyNudge(fixture.owner.id, hydration!.id, fixture.now)

    const ventilation = await claimDueBreezyNudge(fixture.owner.id, fixture.entry.id, fixture.now)
    expect(ventilation).toMatchObject({ type: 'ventilation', message: nudgeMessages.ventilation })
    await acknowledgeBreezyNudge(fixture.owner.id, ventilation!.id, fixture.now)

    await expect(claimDueBreezyNudge(fixture.owner.id, fixture.entry.id, fixture.now)).resolves.toBeNull()
  })

  it('does not advance cadence while pause and excluded idle leave insufficient working time', async () => {
    const fixture = await createNudgeFixtures(150, { prefix: 'excluded' })
    await createSettings(fixture.owner.id, { nudgeCadenceMinutes: 90 })
    await integrationPrisma.entryPause.create({
      data: {
        entryId: fixture.entry.id,
        startedAt: new Date(fixture.now.getTime() - 120 * 60_000),
        endedAt: new Date(fixture.now.getTime() - 90 * 60_000),
        durationSeconds: 1_800
      }
    })
    await integrationPrisma.timeEntry.update({ where: { id: fixture.entry.id }, data: { excludedIdleSeconds: 31 * 60 } })

    const longFocus = await claimDueBreezyNudge(fixture.owner.id, fixture.entry.id, fixture.now)
    await acknowledgeBreezyNudge(fixture.owner.id, longFocus!.id, fixture.now)
    await expect(claimDueBreezyNudge(fixture.owner.id, fixture.entry.id, fixture.now)).resolves.toBeNull()
  })

  it('restores latest owner-only nudges with unacknowledged rows first and at most 20', async () => {
    const { owner, other, entry, now } = await createNudgeFixtures(60, { prefix: 'bootstrap' })
    const otherTask = await createTaskFixture({ id: 'bootstrap-other-task', ownerId: other.id })
    const otherEntry = await createEntryFixture({ id: 'bootstrap-other-entry', userId: other.id, taskId: otherTask.id, active: true })
    for (let index = 0; index < 22; index += 1) {
      await integrationPrisma.breezyNudge.create({
        data: {
          id: `owner-nudge-${String(index).padStart(2, '0')}`,
          userId: owner.id,
          relatedEntryId: entry.id,
          type: 'hydration',
          message: nudgeMessages.hydration,
          shownAt: new Date(now.getTime() + index * 1_000),
          acknowledgedAt: index === 0 ? null : new Date(now.getTime() + index * 1_000 + 500)
        }
      })
    }
    await integrationPrisma.breezyNudge.create({
      data: {
        id: 'other-private-nudge', userId: other.id, relatedEntryId: otherEntry.id,
        type: 'ventilation', message: nudgeMessages.ventilation, shownAt: now
      }
    })

    const state = await publicState(owner.id)
    expect(state.breezyNudges).toHaveLength(20)
    expect(state.breezyNudges.map(nudge => nudge.id)).toEqual([
      'owner-nudge-00',
      ...Array.from({ length: 19 }, (_, index) => `owner-nudge-${String(21 - index).padStart(2, '0')}`)
    ])
    expect(new Set(state.breezyNudges.map(nudge => nudge.id)).size).toBe(20)
    expect(state.breezyNudges.map(nudge => nudge.id)).not.toContain('other-private-nudge')
  })

  it('acknowledges only for the owner and retries idempotently', async () => {
    const { owner, other, entry, now } = await createNudgeFixtures(45, { prefix: 'ack' })
    const nudge = await claimDueBreezyNudge(owner.id, entry.id, now)

    await expect(acknowledgeBreezyNudge(other.id, nudge!.id, now)).rejects.toMatchObject({ statusCode: 404 })
    const first = await acknowledgeBreezyNudge(owner.id, nudge!.id, now)
    const second = await acknowledgeBreezyNudge(owner.id, nudge!.id, new Date(now.getTime() + 60_000))

    expect(first.acknowledgedAt).toBe(now.toISOString())
    expect(second.acknowledgedAt).toBe(now.toISOString())
    expect(await integrationPrisma.breezyNudge.count()).toBe(1)
  })
})

async function createNudgeFixtures(
  elapsedMinutes: number,
  options: { prefix?: string, active?: boolean } = {}
) {
  const prefix = options.prefix || 'nudge'
  const owner = await createUser({ id: `${prefix}-owner`, email: `${prefix}-owner@airgradient.com`, displayName: `${prefix} Owner` })
  const other = await createUser({ id: `${prefix}-other`, email: `${prefix}-other@airgradient.com`, displayName: `${prefix} Other` })
  const task = await createTaskFixture({ id: `${prefix}-task`, ownerId: owner.id })
  const entry = await createEntryFixture({
    id: `${prefix}-entry`, userId: owner.id, taskId: task.id, active: options.active !== false
  })
  const now = new Date('2026-09-02T10:00:00.000Z')
  await integrationPrisma.timeEntry.update({
    where: { id: entry.id },
    data: {
      startedAt: new Date(now.getTime() - elapsedMinutes * 60_000),
      ...(options.active === false ? { endedAt: new Date(now.getTime() - 1_000) } : {})
    }
  })
  return { owner, other, task, entry, now }
}

async function createSettings(
  userId: string,
  overrides: Partial<{ nudgeCadenceMinutes: number, breezyVerbosity: string, muted: boolean }>
) {
  return integrationPrisma.settings.create({
    data: {
      userId,
      idleThresholdMinutes: 5,
      nudgeCadenceMinutes: overrides.nudgeCadenceMinutes ?? 90,
      breezyVerbosity: overrides.breezyVerbosity ?? 'gentle',
      muted: overrides.muted ?? false,
      locationEnabled: false,
      activityEnabled: true,
      locationLabels: []
    }
  })
}
