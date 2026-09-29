import { computed, ref, type ComputedRef } from 'vue'
import { calculateDuration } from '~~/shared/utils/time'
import type { TrackerFetchOptions } from '~/composables/useTrackerApi'
import type { BreezyEvent } from '~/features/breezy/breezyRuntime'
import type { ApiEntry, ApiState } from '~/types/api'

export interface TimerSessionDependencies {
  activeEntry: ComputedRef<ApiEntry | null>
  ensureInlineTask: () => Promise<string>
  hasInlineTaskTitle: ComputedRef<boolean>
  focusTaskInput: () => void
  authFetch: <T>(url: string, options?: TrackerFetchOptions) => Promise<T>
  loadState: (state?: ApiState) => Promise<void>
  onBreezyEvent: (event: BreezyEvent) => void
  onSessionStarted?: () => void
  onSessionResumed?: () => void
}

export function useTimerSession(dependencies: TimerSessionDependencies) {
  const elapsedSeconds = ref(0)
  const pausedAt = ref<string | null>(null)
  const isUpdatingPause = ref(false)
  const timerActionError = ref('')
  let timerId: ReturnType<typeof setInterval> | null = null
  let disposed = false

  const primaryTimerLabel = computed(() => {
    if (!dependencies.activeEntry.value) return 'Start'
    return pausedAt.value ? 'Resume' : 'Take a Break'
  })

  function clearTimerInterval() {
    if (timerId) clearInterval(timerId)
    timerId = null
  }

  function disposeTimer() {
    disposed = true
    clearTimerInterval()
  }

  function syncTimerSession() {
    if (disposed) return
    timerActionError.value = ''
    clearTimerInterval()
    const entry = dependencies.activeEntry.value
    const openPause = entry?.pauses.find(pause => pause.endedAt === null)
    pausedAt.value = openPause?.startedAt || null
    if (!entry) {
      elapsedSeconds.value = 0
      return
    }

    const tick = () => {
      if (disposed) return
      const current = dependencies.activeEntry.value
      if (!current) return
      elapsedSeconds.value = calculateDuration(
        current.startedAt,
        pausedAt.value || new Date().toISOString(),
        current.pauses,
        current.excludedIdleSeconds
      )
    }

    tick()
    timerId = setInterval(tick, 1_000)
  }

  async function startTimer() {
    if (disposed) return
    timerActionError.value = ''
    const taskId = await dependencies.ensureInlineTask()
    if (!taskId || disposed) return
    const next = await dependencies.authFetch<ApiState>('/api/timer-start', {
      method: 'POST',
      body: { taskId }
    })
    if (disposed) return
    dependencies.onSessionStarted?.()
    await dependencies.loadState(next)
    if (disposed) return
    dependencies.onBreezyEvent({ type: 'session-started' })
  }

  async function pauseTimer() {
    if (disposed) return
    const entry = dependencies.activeEntry.value
    if (!entry || isUpdatingPause.value) return
    timerActionError.value = ''
    isUpdatingPause.value = true
    try {
      const next = await dependencies.authFetch<ApiState>('/api/timer-pause', {
        method: 'POST',
        body: { entryId: entry.id }
      })
      if (disposed) return
      await dependencies.loadState(next)
      if (disposed) return
      dependencies.onBreezyEvent({ type: 'session-paused' })
    } catch {
      if (disposed) return
      await dependencies.loadState().catch(() => null)
      if (disposed) return
      timerActionError.value = 'Could not pause the timer. Its server state was refreshed.'
    } finally {
      isUpdatingPause.value = false
    }
  }

  async function resumeTimer() {
    if (disposed) return
    const entry = dependencies.activeEntry.value
    if (!entry || !pausedAt.value || isUpdatingPause.value) return
    timerActionError.value = ''
    isUpdatingPause.value = true
    try {
      const next = await dependencies.authFetch<ApiState>('/api/timer-resume', {
        method: 'POST',
        body: { entryId: entry.id }
      })
      if (disposed) return
      await dependencies.loadState(next)
      if (disposed) return
      dependencies.onSessionResumed?.()
      dependencies.onBreezyEvent({ type: 'session-resumed' })
    } catch {
      if (disposed) return
      await dependencies.loadState().catch(() => null)
      if (disposed) return
      timerActionError.value = 'Could not resume the timer. Its server state was refreshed.'
    } finally {
      isUpdatingPause.value = false
    }
  }

  async function handlePrimaryTimerAction() {
    if (disposed) return
    if (!dependencies.activeEntry.value) {
      if (!dependencies.hasInlineTaskTitle.value) {
        dependencies.focusTaskInput()
        dependencies.onBreezyEvent({ type: 'task-required' })
        return
      }
      await startTimer()
      return
    }
    if (pausedAt.value) {
      await resumeTimer()
      return
    }
    await pauseTimer()
  }

  return {
    disposeTimer,
    elapsedSeconds,
    handlePrimaryTimerAction,
    isUpdatingPause,
    pauseTimer,
    pausedAt,
    primaryTimerLabel,
    resumeTimer,
    startTimer,
    syncTimerSession,
    timerActionError
  }
}
