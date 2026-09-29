import { readonly, ref, type ComputedRef, type Ref } from 'vue'
import type { TrackerFetchOptions } from '~/composables/useTrackerApi'
import type { BreezyEvent } from './breezyRuntime'
import type { ApiBreezyNudge, ApiEntry, ApiSettings } from '~/types/api'

export interface BreezyNudgeDependencies {
  activeEntry: ComputedRef<ApiEntry | null>
  pausedAt: Ref<string | null>
  settings: Pick<ApiSettings, 'muted' | 'breezyVerbosity'>
  suppressed: ComputedRef<boolean>
  restoredNudges: ComputedRef<ApiBreezyNudge[]>
  authFetch: <T>(url: string, options?: TrackerFetchOptions) => Promise<T>
  publish: (event: BreezyEvent) => void
}

const claimIntervalMs = 30_000

export function useBreezyNudges(dependencies: BreezyNudgeDependencies) {
  const activeNudge = ref<ApiBreezyNudge | null>(null)
  const activeNudgeIsRestored = ref(false)
  const dismissNudgeError = ref('')
  const isDismissingNudge = ref(false)
  const locallyAcknowledged = new Set<string>()
  let interval: ReturnType<typeof setInterval> | null = null
  let inFlight: Promise<void> | null = null
  let inFlightEntryId = ''
  let inFlightVersion = 0
  let queuedClaim = false
  let dismissalInFlight: Promise<string | null> | null = null
  let lifecycleVersion = 0
  let lifecycleSignature = ''
  let disposed = false

  function isEligible() {
    return Boolean(dependencies.activeEntry.value)
      && !dependencies.pausedAt.value
      && !dependencies.settings.muted
      && dependencies.settings.breezyVerbosity !== 'quiet'
      && !dependencies.suppressed.value
  }

  function clearIntervalSafely() {
    if (interval) clearInterval(interval)
    interval = null
  }

  function setActiveNudge(nudge: ApiBreezyNudge | null, restored: boolean) {
    if (activeNudge.value?.id !== nudge?.id) dismissNudgeError.value = ''
    activeNudge.value = nudge
    activeNudgeIsRestored.value = Boolean(nudge) && restored
  }

  function syncRestoredNudge() {
    const restored = dependencies.restoredNudges.value.find(item => !item.acknowledgedAt && !locallyAcknowledged.has(item.id)) || null
    if (!activeNudge.value || activeNudgeIsRestored.value) {
      setActiveNudge(restored, true)
      return
    }

    const stillBelongsToSession = dependencies.activeEntry.value?.id === activeNudge.value.relatedEntryId
    const stillPersisted = dependencies.restoredNudges.value.some(item => item.id === activeNudge.value?.id && !item.acknowledgedAt)
    if (!stillBelongsToSession && !stillPersisted) {
      setActiveNudge(restored, true)
    }
  }

  function currentSignature() {
    return `${dependencies.activeEntry.value?.id || ''}|${isEligible()}`
  }

  function claimDueNudge() {
    if (disposed || !isEligible() || activeNudge.value) return
    const entryId = dependencies.activeEntry.value!.id
    if (inFlight) {
      if (inFlightEntryId !== entryId || inFlightVersion !== lifecycleVersion) queuedClaim = true
      return
    }

    const requestVersion = lifecycleVersion
    inFlightEntryId = entryId
    inFlightVersion = requestVersion
    inFlight = dependencies.authFetch<{ nudge: ApiBreezyNudge | null }>('/api/breezy-nudges/claim', {
      method: 'POST',
      body: { entryId }
    }).then((result) => {
      if (disposed || requestVersion !== lifecycleVersion || dependencies.activeEntry.value?.id !== entryId || !isEligible()) return
      if (!result.nudge || result.nudge.acknowledgedAt || result.nudge.relatedEntryId !== entryId) return
      setActiveNudge(result.nudge, false)
      dependencies.publish({
        type: result.nudge.type,
        nudgeId: result.nudge.id,
        message: result.nudge.message
      })
    }).catch(() => {
      // A cadence check is best-effort. The next interval safely retries.
    }).finally(() => {
      inFlight = null
      inFlightEntryId = ''
      if (queuedClaim && !disposed) {
        queuedClaim = false
        claimDueNudge()
      }
    })
  }

  function syncNudgeScheduler() {
    if (disposed) return
    syncRestoredNudge()
    clearIntervalSafely()

    const nextSignature = currentSignature()
    if (nextSignature !== lifecycleSignature) {
      lifecycleSignature = nextSignature
      lifecycleVersion += 1
    }
    if (!isEligible()) return

    claimDueNudge()
    interval = setInterval(claimDueNudge, claimIntervalMs)
  }

  function dismissActiveNudge(): Promise<string | null> {
    if (disposed) return Promise.resolve(null)
    if (dismissalInFlight) return dismissalInFlight
    const dismissed = activeNudge.value
    if (!dismissed) return Promise.resolve(null)
    dismissNudgeError.value = ''
    isDismissingNudge.value = true

    const request = dependencies.authFetch<{ nudge: ApiBreezyNudge }>(`/api/breezy-nudges/${dismissed.id}`, { method: 'PATCH' })
      .then(() => {
        if (disposed) return null
        locallyAcknowledged.add(dismissed.id)
        if (activeNudge.value?.id !== dismissed.id) return null
        setActiveNudge(null, false)
        return dismissed.id
      })
      .catch(() => {
        if (!disposed) dismissNudgeError.value = 'Could not dismiss this reminder. Please try again.'
        return null
      })
      .finally(() => {
        if (dismissalInFlight === request) dismissalInFlight = null
        if (!disposed) isDismissingNudge.value = false
      })
    dismissalInFlight = request
    return request
  }

  function disposeNudgeScheduler() {
    disposed = true
    lifecycleVersion += 1
    queuedClaim = false
    clearIntervalSafely()
  }

  return {
    activeNudge: readonly(activeNudge),
    activeNudgeIsRestored: readonly(activeNudgeIsRestored),
    dismissNudgeError: readonly(dismissNudgeError),
    dismissActiveNudge,
    disposeNudgeScheduler,
    isDismissingNudge: readonly(isDismissingNudge),
    syncNudgeScheduler
  }
}
