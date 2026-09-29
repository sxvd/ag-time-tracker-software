import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrackerFetchOptions } from '../../frontend/composables/useTrackerApi'
import { useTimerSession } from '../../frontend/features/tracking/useTimerSession'
import type { TimerSessionDependencies } from '../../frontend/features/tracking/useTimerSession'
import type { ApiEntry, ApiState } from '../../frontend/types/api'

describe('timer session coordination', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-08-25T10:30:00.000Z')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores an active entry, its open pause, and elapsed time from server state', () => {
    const activeEntry = ref<ApiEntry | null>(entry({
      startedAt: '2026-08-25T10:00:00.000Z',
      excludedIdleSeconds: 60,
      pauses: [{
        startedAt: '2026-08-25T10:05:00.000Z',
        endedAt: '2026-08-25T10:10:00.000Z',
        durationSeconds: 300
      }]
    }))
    const timer = createTimer(activeEntry)

    timer.syncTimerSession()

    expect(timer.pausedAt.value).toBeNull()
    expect(timer.elapsedSeconds.value).toBe(1_440)
    vi.advanceTimersByTime(1_000)
    expect(timer.elapsedSeconds.value).toBe(1_441)

    activeEntry.value = entry({
      startedAt: '2026-08-25T10:00:00.000Z',
      excludedIdleSeconds: 60,
      pauses: [
        {
          startedAt: '2026-08-25T10:05:00.000Z',
          endedAt: '2026-08-25T10:10:00.000Z',
          durationSeconds: 300
        },
        {
          startedAt: '2026-08-25T10:20:00.000Z',
          endedAt: null,
          durationSeconds: null
        }
      ]
    })
    timer.syncTimerSession()

    expect(timer.pausedAt.value).toBe('2026-08-25T10:20:00.000Z')
    expect(timer.elapsedSeconds.value).toBe(840)
    vi.advanceTimersByTime(5_000)
    expect(timer.elapsedSeconds.value).toBe(840)

    timer.disposeTimer()
  })

  it('orders exact start, pause, and resume requests around authoritative state refreshes', async () => {
    const events: string[] = []
    const startedState = stateWith(entry())
    const startFetch = vi.fn(async (url: string, options?: TrackerFetchOptions) => {
      events.push(`request:${url}`)
      expect(options).toEqual({ method: 'POST', body: { taskId: 'task-1' } })
      return startedState
    })
    const startTimer = createTimer(ref(null), {
      ensureInlineTask: async () => {
        events.push('ensure-task')
        return 'task-1'
      },
      authFetch: startFetch as TimerSessionDependencies['authFetch'],
      loadState: async (next?: ApiState) => {
        expect(next).toBe(startedState)
        events.push('load-started-state')
      },
      onSessionStarted: () => events.push('reset-activity')
    })

    await startTimer.handlePrimaryTimerAction()

    expect(events).toEqual([
      'ensure-task',
      'request:/api/timer-start',
      'reset-activity',
      'load-started-state'
    ])
    expect(startTimer.onBreezyEvent).toHaveBeenCalledWith({ type: 'session-started' })

    events.length = 0
    const running = ref<ApiEntry | null>(entry())
    const pausedState = stateWith(entry({
      pauses: [{
        startedAt: '2026-08-25T10:20:00.000Z',
        endedAt: null,
        durationSeconds: null
      }]
    }))
    const pauseTimer = createTimer(running, {
      authFetch: async <T>(url: string, options?: TrackerFetchOptions) => {
        events.push(`request:${url}`)
        expect(options).toEqual({ method: 'POST', body: { entryId: 'entry-1' } })
        return pausedState as T
      },
      loadState: async (next?: ApiState) => {
        expect(next).toBe(pausedState)
        events.push('load-paused-state')
      }
    })

    await pauseTimer.handlePrimaryTimerAction()

    expect(events).toEqual(['request:/api/timer-pause', 'load-paused-state'])
    expect(pauseTimer.onBreezyEvent).toHaveBeenCalledWith({ type: 'session-paused' })

    events.length = 0
    const paused = ref<ApiEntry | null>(pausedState.entries[0]!)
    const resumedState = stateWith(entry())
    const resumeTimer = createTimer(paused, {
      authFetch: async <T>(url: string, options?: TrackerFetchOptions) => {
        events.push(`request:${url}`)
        expect(options).toEqual({ method: 'POST', body: { entryId: 'entry-1' } })
        return resumedState as T
      },
      loadState: async (next?: ApiState) => {
        expect(next).toBe(resumedState)
        events.push('load-resumed-state')
      },
      onSessionResumed: () => events.push('reset-activity')
    })
    resumeTimer.syncTimerSession()

    await resumeTimer.handlePrimaryTimerAction()

    expect(events).toEqual([
      'request:/api/timer-resume',
      'load-resumed-state',
      'reset-activity'
    ])
    expect(resumeTimer.onBreezyEvent).toHaveBeenCalledWith({ type: 'session-resumed' })

    startTimer.disposeTimer()
    pauseTimer.disposeTimer()
    resumeTimer.disposeTimer()
  })

  it('focuses the task input and does not mutate when start has no task title', async () => {
    const focusTaskInput = vi.fn()
    const authFetch = vi.fn()
    const timer = createTimer(ref(null), {
      authFetch,
      focusTaskInput,
      hasInlineTaskTitle: computed(() => false)
    })

    await timer.handlePrimaryTimerAction()

    expect(focusTaskInput).toHaveBeenCalledOnce()
    expect(authFetch).not.toHaveBeenCalled()
    expect(timer.onBreezyEvent).toHaveBeenCalledWith({ type: 'task-required' })
  })

  it('replaces restored state without retaining client-only pause or elapsed values', () => {
    const activeEntry = ref<ApiEntry | null>(entry({
      pauses: [{
        startedAt: '2026-08-25T10:20:00.000Z',
        endedAt: null,
        durationSeconds: null
      }]
    }))
    const timer = createTimer(activeEntry)
    timer.syncTimerSession()
    expect(timer.pausedAt.value).not.toBeNull()
    expect(timer.elapsedSeconds.value).toBeGreaterThan(0)

    activeEntry.value = null
    timer.syncTimerSession()

    expect(timer.pausedAt.value).toBeNull()
    expect(timer.elapsedSeconds.value).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans up its single elapsed-time interval', () => {
    const timer = createTimer(ref(entry()))
    timer.syncTimerSession()
    expect(vi.getTimerCount()).toBe(1)

    timer.disposeTimer()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not apply a delayed pause response or recreate its interval after disposal', async () => {
    const activeEntry = ref<ApiEntry | null>(entry())
    const pausedState = stateWith(entry({
      pauses: [{
        startedAt: '2026-08-25T10:20:00.000Z',
        endedAt: null,
        durationSeconds: null
      }]
    }))
    const response = deferred<ApiState>()
    let timer!: ReturnType<typeof createTimer>
    const loadState = vi.fn(async (next?: ApiState) => {
      activeEntry.value = next?.entries[0] || null
      timer.syncTimerSession()
    })
    timer = createTimer(activeEntry, {
      authFetch: vi.fn(() => response.promise) as TimerSessionDependencies['authFetch'],
      loadState
    })
    timer.syncTimerSession()

    const pause = timer.pauseTimer()
    await Promise.resolve()
    timer.disposeTimer()
    response.resolve(pausedState)
    await pause

    expect(loadState).not.toHaveBeenCalled()
    expect(activeEntry.value?.pauses).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    expect(timer.onBreezyEvent).not.toHaveBeenCalled()
  })

  it.each([
    ['pause', entry(), 'Could not pause the timer. Its server state was refreshed.'],
    ['resume', entry({ pauses: [{ startedAt: '2026-08-25T10:20:00.000Z', endedAt: null, durationSeconds: null }] }), 'Could not resume the timer. Its server state was refreshed.']
  ] as const)('keeps a failed %s message next to the timer control instead of publishing it through Breezy', async (action, active, expected) => {
    const loadState = vi.fn(async () => undefined)
    const timer = createTimer(ref<ApiEntry | null>(active), {
      authFetch: vi.fn(async () => { throw new Error('private server detail') }) as TimerSessionDependencies['authFetch'],
      loadState
    })
    timer.syncTimerSession()

    await (action === 'pause' ? timer.pauseTimer() : timer.resumeTimer())

    expect(timer.timerActionError.value).toBe(expected)
    expect(timer.onBreezyEvent).not.toHaveBeenCalled()
    expect(loadState).toHaveBeenCalledWith()
    timer.disposeTimer()
  })
})

function createTimer(activeEntry: ReturnType<typeof ref<ApiEntry | null>>, overrides: Partial<TimerSessionDependencies> = {}) {
  const onBreezyEvent = vi.fn()
  const timer = useTimerSession({
    activeEntry: computed<ApiEntry | null>(() => activeEntry.value ?? null),
    ensureInlineTask: async () => 'task-1',
    hasInlineTaskTitle: computed(() => true),
    focusTaskInput: () => undefined,
    authFetch: async <T>() => stateWith(entry()) as T,
    loadState: async () => undefined,
    onBreezyEvent,
    ...overrides
  })
  return { ...timer, onBreezyEvent }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
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
    user: { id: 'user-1', email: 'timer@airgradient.com', displayName: 'Timer', team: 'Software' },
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
