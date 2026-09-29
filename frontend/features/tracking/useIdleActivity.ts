import { ref, type ComputedRef, type Ref } from 'vue'
import type { IdleDecision } from '~~/shared/utils/time'
import { shouldRecordContextSwitch } from '~~/shared/utils/time'
import type { TrackerFetchOptions } from '~/composables/useTrackerApi'
import type { BreezyEvent } from '~/features/breezy/breezyRuntime'
import type { ApiEntry, ApiState } from '~/types/api'

type ActivityVisibility = 'visible' | 'hidden'
const CONTEXT_SWITCH_DEDUP_MS = 1_500

export interface ActivityEventTarget {
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void
}

export interface IdleActivityDependencies {
  state: Ref<ApiState | null>
  activeEntry: ComputedRef<ApiEntry | null>
  pausedAt: Ref<string | null>
  showFeedback: Ref<boolean>
  settings: {
    idleThresholdMinutes: number
    activityEnabled: boolean
  }
  authFetch: <T>(url: string, options?: TrackerFetchOptions) => Promise<T>
  loadState: (state?: ApiState) => Promise<void>
  onBreezyEvent: (event: BreezyEvent) => void
  getVisibilityState?: () => ActivityVisibility
  documentTarget?: ActivityEventTarget
  windowTarget?: ActivityEventTarget
  createDecisionId?: () => string
}

export interface IdlePrompt {
  decisionId: string
  entryId: string
  startedAt: string
  endedAt: string
  idleSeconds: number
}

export function useIdleActivity(dependencies: IdleActivityDependencies) {
  const contextSwitches = ref(0)
  const idleSeconds = ref(0)
  const excludedIdleSeconds = ref(0)
  const idlePrompt = ref<IdlePrompt | null>(null)
  const idleDecisionError = ref('')
  const isSavingIdleDecision = ref(false)
  const getVisibilityState = dependencies.getVisibilityState || (() => document.visibilityState as ActivityVisibility)
  const documentTarget = dependencies.documentTarget || document
  const windowTarget = dependencies.windowTarget || window
  let previousVisibilityState: ActivityVisibility = 'visible'
  let contextSwitchQueue: Promise<void> = Promise.resolve()
  let lastContextSwitchAt = 0
  let lastActivity = Date.now()
  let listenersStarted = false
  let disposed = false

  function syncIdleActivity() {
    if (disposed) return
    const entry = dependencies.activeEntry.value
    if (idlePrompt.value && idlePrompt.value.entryId !== entry?.id) {
      idlePrompt.value = null
      idleDecisionError.value = ''
    }
    contextSwitches.value = entry?.contextSwitches || 0
    idleSeconds.value = entry?.idleSeconds || 0
    excludedIdleSeconds.value = entry?.excludedIdleSeconds || 0
  }

  function createDecisionId() {
    if (dependencies.createDecisionId) return dependencies.createDecisionId()
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `idle-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function noteActivity() {
    if (disposed) return
    const now = Date.now()
    const threshold = Number(dependencies.settings.idleThresholdMinutes || 5) * 60 * 1_000
    const idleFor = now - lastActivity
    if (
      dependencies.activeEntry.value
      && !dependencies.pausedAt.value
      && !dependencies.showFeedback.value
      && dependencies.settings.activityEnabled
      && !idlePrompt.value
      && idleFor > threshold
    ) {
      idleDecisionError.value = ''
      idlePrompt.value = {
        decisionId: createDecisionId(),
        entryId: dependencies.activeEntry.value.id,
        startedAt: new Date(lastActivity).toISOString(),
        endedAt: new Date(now).toISOString(),
        idleSeconds: Math.round(idleFor / 1_000)
      }
      dependencies.onBreezyEvent({ type: 'idle-returned' })
    }
    lastActivity = now
  }

  function resetForStartedSession() {
    if (disposed) return
    contextSwitches.value = 0
    idleSeconds.value = 0
    excludedIdleSeconds.value = 0
    idlePrompt.value = null
    lastActivity = Date.now()
    previousVisibilityState = getVisibilityState()
    lastContextSwitchAt = 0
  }

  function resetAfterResume() {
    if (disposed) return
    lastActivity = Date.now()
  }

  async function saveIdleDecision(decision: IdleDecision) {
    if (disposed) return
    const prompt = idlePrompt.value
    if (!prompt || isSavingIdleDecision.value) return
    if (dependencies.activeEntry.value?.id !== prompt.entryId) {
      idlePrompt.value = null
      return
    }

    idleDecisionError.value = ''
    isSavingIdleDecision.value = true
    try {
      const next = await dependencies.authFetch<ApiState>('/api/timer-idle', {
        method: 'POST',
        body: {
          entryId: prompt.entryId,
          decisionId: prompt.decisionId,
          decision,
          startedAt: prompt.startedAt,
          endedAt: prompt.endedAt
        }
      })
      if (disposed || dependencies.activeEntry.value?.id !== prompt.entryId || idlePrompt.value !== prompt) return
      await dependencies.loadState(next)
      if (disposed || dependencies.activeEntry.value?.id !== prompt.entryId || idlePrompt.value !== prompt) return
      idlePrompt.value = null
      dependencies.onBreezyEvent({ type: 'idle-saved', decision })
    } catch {
      if (disposed || dependencies.activeEntry.value?.id !== prompt.entryId || idlePrompt.value !== prompt) return
      idleDecisionError.value = 'Could not save your inactivity choice. Please try again.'
    } finally {
      isSavingIdleDecision.value = false
    }
  }

  function queueContextSwitch() {
    const entryId = dependencies.activeEntry.value?.id
    const now = Date.now()
    if (
      !entryId
      || dependencies.pausedAt.value
      || !dependencies.settings.activityEnabled
      || now - lastContextSwitchAt < CONTEXT_SWITCH_DEDUP_MS
    ) return
    lastContextSwitchAt = now

    contextSwitchQueue = contextSwitchQueue
      .catch(() => undefined)
      .then(async () => {
        if (disposed || dependencies.activeEntry.value?.id !== entryId) return
        try {
          const result = await dependencies.authFetch<{ entryId: string, contextSwitches: number }>('/api/timer-context-switch', {
            method: 'POST',
            body: { entryId }
          })
          if (disposed || result.entryId !== entryId || dependencies.activeEntry.value?.id !== entryId) return

          contextSwitches.value = result.contextSwitches
          const savedEntry = dependencies.state.value?.entries.find(candidate => candidate.id === entryId)
          if (savedEntry) savedEntry.contextSwitches = result.contextSwitches
        } catch {
          if (!disposed && dependencies.activeEntry.value?.id === entryId) {
            await dependencies.loadState().catch(() => null)
          }
        }
      })
  }

  function handleVisibility() {
    if (disposed) return
    const current = getVisibilityState()
    const previous = previousVisibilityState
    previousVisibilityState = current

    if (!shouldRecordContextSwitch({
      previous,
      current,
      active: Boolean(dependencies.activeEntry.value),
      paused: Boolean(dependencies.pausedAt.value),
      enabled: dependencies.settings.activityEnabled
    })) return

    queueContextSwitch()
  }

  function handleWindowBlur() {
    if (disposed) return
    queueContextSwitch()
  }

  function waitForContextSwitches() {
    return contextSwitchQueue
  }

  function startActivityListeners() {
    if (disposed || listenersStarted) return
    previousVisibilityState = getVisibilityState()
    documentTarget.addEventListener('visibilitychange', handleVisibility)
    windowTarget.addEventListener('blur', handleWindowBlur)
    windowTarget.addEventListener('mousemove', noteActivity)
    windowTarget.addEventListener('keydown', noteActivity)
    listenersStarted = true
  }

  function disposeActivityListeners() {
    disposed = true
    if (!listenersStarted) return
    documentTarget.removeEventListener('visibilitychange', handleVisibility)
    windowTarget.removeEventListener('blur', handleWindowBlur)
    windowTarget.removeEventListener('mousemove', noteActivity)
    windowTarget.removeEventListener('keydown', noteActivity)
    listenersStarted = false
  }

  return {
    contextSwitches,
    disposeActivityListeners,
    excludedIdleSeconds,
    handleWindowBlur,
    handleVisibility,
    idleDecisionError,
    idlePrompt,
    idleSeconds,
    isSavingIdleDecision,
    noteActivity,
    resetAfterResume,
    resetForStartedSession,
    saveIdleDecision,
    startActivityListeners,
    syncIdleActivity,
    waitForContextSwitches
  }
}
