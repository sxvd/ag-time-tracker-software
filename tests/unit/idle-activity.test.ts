import { computed, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackerFetchOptions } from '../../frontend/composables/useTrackerApi'
import { useIdleActivity } from '../../frontend/features/tracking/useIdleActivity'
import type { IdleActivityDependencies } from '../../frontend/features/tracking/useIdleActivity'
import type { ApiEntry, ApiState } from '../../frontend/types/api'

describe('idle and context-switch coordination', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-08-25T10:00:00.000Z')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores server-authoritative idle and context-switch values', () => {
    const active = ref<ApiEntry | null>(entry({
      idleSeconds: 420,
      excludedIdleSeconds: 180,
      contextSwitches: 6
    }))
    const activity = createActivity(active)

    activity.syncIdleActivity()

    expect(activity.idleSeconds.value).toBe(420)
    expect(activity.excludedIdleSeconds.value).toBe(180)
    expect(activity.contextSwitches.value).toBe(6)

    active.value = null
    activity.syncIdleActivity()
    expect(activity.idleSeconds.value).toBe(0)
    expect(activity.excludedIdleSeconds.value).toBe(0)
    expect(activity.contextSwitches.value).toBe(0)
  })

  it('opens only one prompt for an idle interval and suppresses prompts when activity tracking is off', () => {
    const active = ref<ApiEntry | null>(entry())
    const settings = reactive({ idleThresholdMinutes: 5, activityEnabled: true })
    const activity = createActivity(active, { settings, createDecisionId: () => 'decision-1' })

    vi.advanceTimersByTime(5 * 60 * 1_000 + 1_000)
    activity.noteActivity()
    const firstPrompt = activity.idlePrompt.value

    expect(firstPrompt).toEqual({
      decisionId: 'decision-1',
      entryId: 'entry-1',
      startedAt: '2026-08-25T10:00:00.000Z',
      endedAt: '2026-08-25T10:05:01.000Z',
      idleSeconds: 301
    })

    vi.advanceTimersByTime(10 * 60 * 1_000)
    activity.noteActivity()
    expect(activity.idlePrompt.value).toBe(firstPrompt)

    activity.resetForStartedSession()
    settings.activityEnabled = false
    vi.advanceTimersByTime(10 * 60 * 1_000)
    activity.noteActivity()
    expect(activity.idlePrompt.value).toBeNull()
  })

  it.each(['keep', 'discard', 'break'] as const)('sends the exact idempotent %s idle decision contract', async (decision) => {
    const active = ref<ApiEntry | null>(entry())
    const next = stateWith(entry({ idleSeconds: 301 }))
    const authFetch = vi.fn(async (_url: string, _options?: TrackerFetchOptions) => next)
    const loadState = vi.fn(async () => undefined)
    const activity = createActivity(active, {
      authFetch: authFetch as IdleActivityDependencies['authFetch'],
      loadState,
      createDecisionId: () => `decision-${decision}`
    })
    vi.advanceTimersByTime(301_000)
    activity.noteActivity()

    await activity.saveIdleDecision(decision)

    expect(authFetch).toHaveBeenCalledWith('/api/timer-idle', {
      method: 'POST',
      body: {
        entryId: 'entry-1',
        decisionId: `decision-${decision}`,
        decision,
        startedAt: '2026-08-25T10:00:00.000Z',
        endedAt: '2026-08-25T10:05:01.000Z'
      }
    })
    expect(loadState).toHaveBeenCalledWith(next)
    expect(activity.idlePrompt.value).toBeNull()
    expect(activity.onBreezyEvent).toHaveBeenLastCalledWith({ type: 'idle-saved', decision })
  })

  it('does not save an idle prompt after the active entry has been replaced', async () => {
    const active = ref<ApiEntry | null>(entry())
    const authFetch = vi.fn()
    const activity = createActivity(active, { authFetch, createDecisionId: () => 'stale-decision' })
    vi.advanceTimersByTime(301_000)
    activity.noteActivity()
    active.value = entry({ id: 'replacement-entry' })

    await activity.saveIdleDecision('discard')

    expect(authFetch).not.toHaveBeenCalled()
    expect(activity.idlePrompt.value).toBeNull()
  })

  it('clears a prompt when authoritative synchronization replaces its entry', () => {
    const active = ref<ApiEntry | null>(entry())
    const activity = createActivity(active, { createDecisionId: () => 'stale-decision' })
    vi.advanceTimersByTime(301_000)
    activity.noteActivity()
    expect(activity.idlePrompt.value?.entryId).toBe('entry-1')

    active.value = entry({ id: 'replacement-entry', idleSeconds: 90 })
    activity.syncIdleActivity()

    expect(activity.idlePrompt.value).toBeNull()
    expect(activity.idleSeconds.value).toBe(90)
  })

  it('ignores an idle response when its entry is replaced while the request is in flight', async () => {
    const active = ref<ApiEntry | null>(entry())
    const response = deferred<ApiState>()
    const loadState = vi.fn(async () => undefined)
    const activity = createActivity(active, {
      authFetch: vi.fn(() => response.promise) as IdleActivityDependencies['authFetch'],
      loadState,
      createDecisionId: () => 'in-flight-decision'
    })
    vi.advanceTimersByTime(301_000)
    activity.noteActivity()
    const save = activity.saveIdleDecision('discard')
    await Promise.resolve()

    active.value = entry({ id: 'replacement-entry', idleSeconds: 90 })
    activity.syncIdleActivity()
    response.resolve(stateWith(entry({ idleSeconds: 301 })))
    await save

    expect(loadState).not.toHaveBeenCalled()
    expect(activity.idlePrompt.value).toBeNull()
    expect(activity.idleSeconds.value).toBe(90)
    expect(activity.onBreezyEvent).toHaveBeenCalledWith({ type: 'idle-returned' })
    expect(activity.onBreezyEvent).not.toHaveBeenCalledWith({ type: 'idle-saved', decision: 'discard' })
  })

  it('does not apply a delayed idle response or restart listeners after disposal', async () => {
    const active = ref<ApiEntry | null>(entry())
    const documentTarget = listenerTarget()
    const windowTarget = listenerTarget()
    const response = deferred<ApiState>()
    const loadState = vi.fn(async () => undefined)
    const activity = createActivity(active, {
      authFetch: vi.fn(() => response.promise) as IdleActivityDependencies['authFetch'],
      loadState,
      createDecisionId: () => 'disposed-decision',
      documentTarget,
      windowTarget
    })
    activity.startActivityListeners()
    vi.advanceTimersByTime(301_000)
    activity.noteActivity()
    const save = activity.saveIdleDecision('keep')
    await Promise.resolve()

    activity.disposeActivityListeners()
    response.resolve(stateWith(entry({ idleSeconds: 301 })))
    await save
    activity.startActivityListeners()

    expect(loadState).not.toHaveBeenCalled()
    expect(documentTarget.addEventListener).toHaveBeenCalledOnce()
    expect(windowTarget.addEventListener).toHaveBeenCalledTimes(3)
    expect(activity.onBreezyEvent).toHaveBeenCalledWith({ type: 'idle-returned' })
    expect(activity.onBreezyEvent).not.toHaveBeenCalledWith({ type: 'idle-saved', decision: 'keep' })
  })

  it('serializes visibility requests and applies only responses for the still-active entry', async () => {
    const active = ref<ApiEntry | null>(entry({ contextSwitches: 2 }))
    let visibility: 'visible' | 'hidden' = 'visible'
    const first = deferred<{ entryId: string, contextSwitches: number }>()
    const second = deferred<{ entryId: string, contextSwitches: number }>()
    const authFetch = vi.fn()
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise)
    const activity = createActivity(active, { authFetch, getVisibilityState: () => visibility })
    activity.startActivityListeners()
    activity.syncIdleActivity()

    visibility = 'hidden'
    activity.handleVisibility()
    visibility = 'visible'
    activity.handleVisibility()
    vi.advanceTimersByTime(1_500)
    visibility = 'hidden'
    activity.handleVisibility()
    await Promise.resolve()
    await Promise.resolve()

    expect(authFetch).toHaveBeenCalledTimes(1)
    expect(authFetch).toHaveBeenNthCalledWith(1, '/api/timer-context-switch', {
      method: 'POST',
      body: { entryId: 'entry-1' }
    })

    first.resolve({ entryId: 'entry-1', contextSwitches: 3 })
    await flushMicrotasks()
    expect(authFetch).toHaveBeenCalledTimes(2)
    second.resolve({ entryId: 'entry-1', contextSwitches: 4 })
    await activity.waitForContextSwitches()

    expect(activity.contextSwitches.value).toBe(4)
    expect(active.value?.contextSwitches).toBe(4)
  })

  it('ignores a stale context-switch response after replacement entry restoration', async () => {
    const firstEntry = entry({ contextSwitches: 2 })
    const active = ref<ApiEntry | null>(firstEntry)
    let visibility: 'visible' | 'hidden' = 'visible'
    const response = deferred<{ entryId: string, contextSwitches: number }>()
    const loadState = vi.fn(async () => undefined)
    const activity = createActivity(active, {
      authFetch: vi.fn(async () => response.promise) as IdleActivityDependencies['authFetch'],
      getVisibilityState: () => visibility,
      loadState
    })
    activity.startActivityListeners()
    activity.syncIdleActivity()
    visibility = 'hidden'
    activity.handleVisibility()
    await Promise.resolve()

    active.value = entry({ id: 'replacement-entry', contextSwitches: 9 })
    activity.syncIdleActivity()
    response.resolve({ entryId: 'entry-1', contextSwitches: 99 })
    await activity.waitForContextSwitches()

    expect(activity.contextSwitches.value).toBe(9)
    expect(active.value.contextSwitches).toBe(9)
    expect(loadState).not.toHaveBeenCalled()
  })

  it('does not apply an in-flight context response after disposal', async () => {
    const activeEntry = entry({ contextSwitches: 2 })
    const active = ref<ApiEntry | null>(activeEntry)
    let visibility: 'visible' | 'hidden' = 'visible'
    const response = deferred<{ entryId: string, contextSwitches: number }>()
    const activity = createActivity(active, {
      authFetch: vi.fn(() => response.promise) as IdleActivityDependencies['authFetch'],
      getVisibilityState: () => visibility
    })
    activity.startActivityListeners()
    activity.syncIdleActivity()
    visibility = 'hidden'
    activity.handleVisibility()
    await Promise.resolve()

    activity.disposeActivityListeners()
    response.resolve({ entryId: 'entry-1', contextSwitches: 99 })
    await activity.waitForContextSwitches()

    expect(activity.contextSwitches.value).toBe(2)
    expect(activeEntry.contextSwitches).toBe(2)
  })

  it('suppresses context-switch events when activity tracking is off or the timer is paused', async () => {
    const active = ref<ApiEntry | null>(entry())
    const pausedAt = ref<string | null>(null)
    const settings = reactive({ idleThresholdMinutes: 5, activityEnabled: false })
    let visibility: 'visible' | 'hidden' = 'visible'
    const authFetch = vi.fn()
    const activity = createActivity(active, {
      authFetch,
      getVisibilityState: () => visibility,
      pausedAt,
      settings
    })
    activity.startActivityListeners()

    visibility = 'hidden'
    activity.handleVisibility()
    await activity.waitForContextSwitches()

    settings.activityEnabled = true
    pausedAt.value = '2026-08-25T10:01:00.000Z'
    visibility = 'visible'
    activity.handleVisibility()
    visibility = 'hidden'
    activity.handleVisibility()
    await activity.waitForContextSwitches()

    expect(authFetch).not.toHaveBeenCalled()
  })

  it('counts a window blur when work is active', async () => {
    const active = ref<ApiEntry | null>(entry({ contextSwitches: 2 }))
    const authFetch = vi.fn(async () => ({ entryId: 'entry-1', contextSwitches: 3 }))
    const activity = createActivity(active, { authFetch: authFetch as IdleActivityDependencies['authFetch'] })

    activity.handleWindowBlur()
    await activity.waitForContextSwitches()

    expect(authFetch).toHaveBeenCalledOnce()
    expect(authFetch).toHaveBeenCalledWith('/api/timer-context-switch', {
      method: 'POST',
      body: { entryId: 'entry-1' }
    })
    expect(activity.contextSwitches.value).toBe(3)
  })

  it('de-duplicates blur and visibility events emitted for the same switch', async () => {
    const active = ref<ApiEntry | null>(entry())
    let visibility: 'visible' | 'hidden' = 'visible'
    const authFetch = vi.fn(async () => ({ entryId: 'entry-1', contextSwitches: 1 }))
    const activity = createActivity(active, {
      authFetch: authFetch as IdleActivityDependencies['authFetch'],
      getVisibilityState: () => visibility
    })
    activity.startActivityListeners()

    activity.handleWindowBlur()
    visibility = 'hidden'
    activity.handleVisibility()
    await activity.waitForContextSwitches()

    expect(authFetch).toHaveBeenCalledOnce()
  })

  it('removes the exact document and window listeners it registered', () => {
    const documentTarget = listenerTarget()
    const windowTarget = listenerTarget()
    const activity = createActivity(ref(entry()), { documentTarget, windowTarget })

    activity.startActivityListeners()
    activity.disposeActivityListeners()

    expect(documentTarget.addEventListener).toHaveBeenCalledOnce()
    expect(documentTarget.addEventListener.mock.calls[0]?.[0]).toBe('visibilitychange')
    expect(documentTarget.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      documentTarget.addEventListener.mock.calls[0]?.[1]
    )
    expect(windowTarget.addEventListener.mock.calls.map(([type]) => type)).toEqual(['blur', 'mousemove', 'keydown'])
    expect(windowTarget.removeEventListener.mock.calls).toEqual([
      ['blur', windowTarget.addEventListener.mock.calls[0]?.[1]],
      ['mousemove', windowTarget.addEventListener.mock.calls[1]?.[1]],
      ['keydown', windowTarget.addEventListener.mock.calls[2]?.[1]]
    ])
  })
})

function createActivity(activeEntry: ReturnType<typeof ref<ApiEntry | null>>, overrides: Partial<IdleActivityDependencies> = {}) {
  const onBreezyEvent = vi.fn()
  const state = ref<ApiState | null>(stateWith(activeEntry.value || entry()))
  const activity = useIdleActivity({
    state,
    activeEntry: computed<ApiEntry | null>(() => activeEntry.value ?? null),
    pausedAt: ref(null),
    showFeedback: ref(false),
    settings: reactive({ idleThresholdMinutes: 5, activityEnabled: true }),
    authFetch: async <T>() => stateWith(entry()) as T,
    loadState: async () => undefined,
    onBreezyEvent,
    getVisibilityState: () => 'visible',
    documentTarget: listenerTarget(),
    windowTarget: listenerTarget(),
    ...overrides
  })
  return { ...activity, onBreezyEvent }
}

function listenerTarget() {
  return {
    addEventListener: vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>(),
    removeEventListener: vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>()
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function flushMicrotasks() {
  for (let index = 0; index < 6; index += 1) await Promise.resolve()
}

function entry(overrides: Partial<ApiEntry> = {}): ApiEntry {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    userId: 'user-1',
    startedAt: '2026-08-25T10:00:00.000Z',
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
    createdAt: '2026-08-25T10:00:00.000Z',
    ...overrides
  }
}

function stateWith(activeEntry: ApiEntry): ApiState {
  return {
    user: { id: 'user-1', email: 'idle@airgradient.com', displayName: 'Idle', team: 'Software' },
    users: [],
    signedInUsers: [],
    taskInvitations: [],
    categories: [],
    clients: [],
    projects: [],
    blockers: [],
    tasks: [],
    entries: [activeEntry],
    sharedTaskEffort: [],
    breezyNudges: [],
    settings: {
      idleThresholdMinutes: 5,
      nudgeCadenceMinutes: 50,
      breezyVerbosity: 'gentle',
      muted: false,
      locationEnabled: false,
      activityEnabled: true,
      locationLabels: []
    },
    dashboards: {
      personal: {
        totalHours: 0,
        totalSeconds: 0,
        byCategory: [],
        byTask: [],
        blockers: [],
        flow: [],
        efficiency: [],
        energy: [],
        trend: [],
      }
    },
    journey: [],
    medals: []
  }
}
