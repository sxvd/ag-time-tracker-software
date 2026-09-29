import { computed, reactive, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBreezyNudges } from '../../frontend/features/breezy/useBreezyNudges'
import type { BreezyEvent } from '../../frontend/features/breezy/breezyRuntime'
import type { ApiBreezyNudge, ApiEntry } from '../../frontend/types/api'

afterEach(() => {
  vi.useRealTimers()
})

describe('Breezy nudge scheduler', () => {
  it.each([
    ['inactive', { active: false }],
    ['paused', { paused: true }],
    ['muted', { muted: true }],
    ['quiet', { verbosity: 'quiet' as const }],
    ['suppressed', { suppressed: true }]
  ])('does not schedule or claim while %s', async (_label, overrides) => {
    vi.useFakeTimers()
    const fixture = createFixture(overrides)

    fixture.scheduler.syncNudgeScheduler()
    await vi.runAllTicks()

    expect(vi.getTimerCount()).toBe(0)
    expect(fixture.authFetch).not.toHaveBeenCalled()
  })

  it('claims immediately and every 30 seconds while leaving only one interval after repeated syncs', async () => {
    vi.useFakeTimers()
    const fixture = createFixture()

    fixture.scheduler.syncNudgeScheduler()
    fixture.scheduler.syncNudgeScheduler()
    await vi.runAllTicks()

    expect(fixture.authFetch).toHaveBeenCalledTimes(1)
    expect(fixture.authFetch).toHaveBeenCalledWith('/api/breezy-nudges/claim', {
      method: 'POST',
      body: { entryId: 'entry-1' }
    })
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(fixture.authFetch).toHaveBeenCalledTimes(2)
  })

  it('shows an unacknowledged restored nudge without making a new claim', () => {
    const restored = nudge({ id: 'restored-1', type: 'hydration' })
    const fixture = createFixture({ restored: [restored] })

    fixture.scheduler.syncNudgeScheduler()

    expect(fixture.scheduler.activeNudge.value).toEqual(restored)
    expect(fixture.scheduler.activeNudgeIsRestored.value).toBe(true)
    expect(fixture.authFetch).not.toHaveBeenCalled()
  })

  it.each([
    ['long-focus', 'long-focus'],
    ['hydration', 'hydration'],
    ['ventilation', 'ventilation']
  ] as const)('maps a claimed %s nudge and exact server message to a typed event', async (type, eventType) => {
    const claimed = nudge({ id: `${type}-1`, type, message: `Server ${type} message.` })
    const fixture = createFixture({ claimResult: claimed })

    fixture.scheduler.syncNudgeScheduler()
    await flushPromises()

    expect(fixture.scheduler.activeNudge.value).toEqual(claimed)
    expect(fixture.scheduler.activeNudgeIsRestored.value).toBe(false)
    expect(fixture.publish).toHaveBeenCalledWith({
      type: eventType,
      nudgeId: claimed.id,
      message: claimed.message
    })
  })

  it('ignores a delayed response after the active entry changes', async () => {
    const deferred = promiseWithResolvers<{ nudge: ApiBreezyNudge | null }>()
    const fixture = createFixture({ authFetch: vi.fn(() => deferred.promise) })

    fixture.scheduler.syncNudgeScheduler()
    fixture.activeEntry.value = entry('entry-2')
    fixture.scheduler.syncNudgeScheduler()
    deferred.resolve({ nudge: nudge({ id: 'stale-1' }) })
    await flushPromises()

    expect(fixture.scheduler.activeNudge.value).toBeNull()
    expect(fixture.publish).not.toHaveBeenCalled()
  })

  it('queues one replacement when same-entry eligibility changes during an in-flight claim', async () => {
    const first = promiseWithResolvers<{ nudge: ApiBreezyNudge | null }>()
    const authFetch = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ nudge: null })
    const fixture = createFixture({ authFetch })

    fixture.scheduler.syncNudgeScheduler()
    fixture.suppressed.value = true
    fixture.scheduler.syncNudgeScheduler()
    fixture.suppressed.value = false
    fixture.scheduler.syncNudgeScheduler()
    fixture.scheduler.syncNudgeScheduler()
    expect(authFetch).toHaveBeenCalledTimes(1)

    first.resolve({ nudge: null })
    await flushPromises()

    expect(authFetch).toHaveBeenCalledTimes(2)
  })

  it('acknowledges only on explicit dismissal and clears only the matching active nudge', async () => {
    const first = nudge({ id: 'nudge-1' })
    const deferred = promiseWithResolvers<{ nudge: ApiBreezyNudge }>()
    const fixture = createFixture({ active: false, restored: [first], authFetch: vi.fn(() => deferred.promise) })
    fixture.scheduler.syncNudgeScheduler()

    const dismissal = fixture.scheduler.dismissActiveNudge()
    expect(fixture.authFetch).toHaveBeenCalledWith('/api/breezy-nudges/nudge-1', { method: 'PATCH' })

    fixture.restored.value = [nudge({ id: 'nudge-2' })]
    fixture.scheduler.syncNudgeScheduler()
    deferred.resolve({ nudge: { ...first, acknowledgedAt: '2026-09-04T01:00:00.000Z' } })
    await expect(dismissal).resolves.toBeNull()

    expect(fixture.scheduler.activeNudge.value?.id).toBe('nudge-2')
  })

  it('deduplicates dismissal, retains the nudge on failure, and allows a safe retry', async () => {
    const first = promiseWithResolvers<{ nudge: ApiBreezyNudge }>()
    const restored = nudge({ id: 'retry-1' })
    const authFetch = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ nudge: { ...restored, acknowledgedAt: '2026-09-04T01:00:00.000Z' } })
    const fixture = createFixture({ active: false, restored: [restored], authFetch })
    fixture.scheduler.syncNudgeScheduler()

    const firstDismissal = fixture.scheduler.dismissActiveNudge()
    const duplicateDismissal = fixture.scheduler.dismissActiveNudge()
    expect(authFetch).toHaveBeenCalledTimes(1)
    expect(fixture.scheduler.isDismissingNudge.value).toBe(true)
    first.reject(new Error('offline'))

    await expect(firstDismissal).resolves.toBeNull()
    await expect(duplicateDismissal).resolves.toBeNull()
    expect(fixture.scheduler.activeNudge.value).toEqual(restored)
    expect(fixture.scheduler.dismissNudgeError.value).toBe('Could not dismiss this reminder. Please try again.')
    expect(fixture.scheduler.isDismissingNudge.value).toBe(false)

    await expect(fixture.scheduler.dismissActiveNudge()).resolves.toBe('retry-1')
    expect(authFetch).toHaveBeenCalledTimes(2)
    expect(fixture.scheduler.activeNudge.value).toBeNull()
    expect(fixture.scheduler.dismissNudgeError.value).toBe('')
  })

  it('clears a dismissal error when a different restored nudge replaces the failed one', async () => {
    const first = nudge({ id: 'failed-1' })
    const second = nudge({ id: 'replacement-2', type: 'ventilation' })
    const authFetch = vi.fn().mockRejectedValueOnce(new Error('offline'))
    const fixture = createFixture({ active: false, restored: [first], authFetch })
    fixture.scheduler.syncNudgeScheduler()

    await fixture.scheduler.dismissActiveNudge()
    expect(fixture.scheduler.activeNudge.value?.id).toBe('failed-1')
    expect(fixture.scheduler.dismissNudgeError.value).not.toBe('')

    fixture.restored.value = [second]
    fixture.scheduler.syncNudgeScheduler()

    expect(fixture.scheduler.activeNudge.value?.id).toBe('replacement-2')
    expect(fixture.scheduler.dismissNudgeError.value).toBe('')
  })

  it('keeps a restored nudge while suppression pauses claims', async () => {
    vi.useFakeTimers()
    const restored = nudge({ id: 'restored-1' })
    const fixture = createFixture({ restored: [restored] })
    fixture.scheduler.syncNudgeScheduler()
    await vi.runAllTicks()
    fixture.suppressed.value = true
    fixture.scheduler.syncNudgeScheduler()

    expect(vi.getTimerCount()).toBe(0)
    expect(fixture.scheduler.activeNudge.value).toEqual(restored)
  })

  it('clears its interval and ignores delayed responses after disposal', async () => {
    vi.useFakeTimers()
    const deferred = promiseWithResolvers<{ nudge: ApiBreezyNudge | null }>()
    const fixture = createFixture({ authFetch: vi.fn(() => deferred.promise) })
    fixture.scheduler.syncNudgeScheduler()
    expect(vi.getTimerCount()).toBe(1)

    fixture.scheduler.disposeNudgeScheduler()
    deferred.resolve({ nudge: nudge({ id: 'late-1' }) })
    await flushPromises()

    expect(vi.getTimerCount()).toBe(0)
    expect(fixture.scheduler.activeNudge.value).toBeNull()
    expect(fixture.publish).not.toHaveBeenCalled()
  })
})

function createFixture(overrides: {
  active?: boolean
  paused?: boolean
  muted?: boolean
  verbosity?: 'quiet' | 'gentle' | 'chatty'
  suppressed?: boolean
  restored?: ApiBreezyNudge[]
  claimResult?: ApiBreezyNudge | null
  authFetch?: ReturnType<typeof vi.fn>
} = {}) {
  const activeEntry = ref<ApiEntry | null>(overrides.active === false ? null : entry('entry-1'))
  const pausedAt = ref(overrides.paused ? '2026-09-04T00:10:00.000Z' : null)
  const settings = reactive({
    muted: overrides.muted ?? false,
    breezyVerbosity: overrides.verbosity ?? 'gentle' as 'quiet' | 'gentle' | 'chatty'
  })
  const suppressed = ref(overrides.suppressed ?? false)
  const restored = ref(overrides.restored ?? [])
  const publish = vi.fn<(event: BreezyEvent) => void>()
  const authFetch = overrides.authFetch ?? vi.fn(async (url: string) => url.endsWith('/claim')
    ? { nudge: overrides.claimResult ?? null }
    : { nudge: null })
  const scheduler = useBreezyNudges({
    activeEntry: computed(() => activeEntry.value),
    pausedAt,
    settings,
    suppressed: computed(() => suppressed.value),
    restoredNudges: computed(() => restored.value),
    authFetch,
    publish
  })
  return { activeEntry, authFetch, publish, restored, scheduler, settings, suppressed }
}

function entry(id: string): ApiEntry {
  return {
    id,
    taskId: 'task-1',
    userId: 'user-1',
    startedAt: '2026-09-04T00:00:00.000Z',
    endedAt: null,
    durationSeconds: 0,
    isManual: false,
    isEdited: false,
    idleSeconds: 0,
    excludedIdleSeconds: 0,
    contextSwitches: 0,
    locationLabel: '',
    pauses: [],
    blockers: [],
    createdAt: '2026-09-04T00:00:00.000Z'
  }
}

function nudge(overrides: Partial<ApiBreezyNudge> = {}): ApiBreezyNudge {
  return {
    id: 'nudge-1',
    relatedEntryId: 'entry-1',
    type: 'long-focus',
    message: 'A server-provided reminder.',
    shownAt: '2026-09-04T00:45:00.000Z',
    acknowledgedAt: null,
    ...overrides
  }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function promiseWithResolvers<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}
