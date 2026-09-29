import { computed, readonly, ref, type Ref } from 'vue'
import {
  normalizeBreezyMood,
  resolveBreezyPresentation,
  type BreezyEvent,
  type BreezyPresentation,
  type BreezyVerbosity
} from './breezyRuntime'

export interface BreezyRuntimeDependencies {
  verbosity: () => BreezyVerbosity
  muted: () => boolean
}

export interface BreezyRuntime {
  presentation: Readonly<Ref<BreezyPresentation>>
  motionKey: Readonly<Ref<number>>
  publish: (event: BreezyEvent) => void
  restore: (input: { active: boolean, paused: boolean, latestJourneyMood?: string }) => void
  dismissNudge: (nudgeId: string, input: { active: boolean, paused: boolean, latestJourneyMood?: string }) => boolean
}

export function useBreezyRuntime(dependencies: BreezyRuntimeDependencies): BreezyRuntime {
  const currentEvent = ref<BreezyEvent>({ type: 'ready' })
  const announceCurrentEvent = ref(false)
  const motionKey = ref(0)

  const presentation = computed(() => {
    const resolved = resolveBreezyPresentation({
      event: currentEvent.value,
      verbosity: dependencies.verbosity(),
      muted: dependencies.muted()
    })

    return announceCurrentEvent.value ? resolved : { ...resolved, announce: false }
  })

  function publish(event: BreezyEvent) {
    currentEvent.value = event
    announceCurrentEvent.value = true
    if (event.type === 'session-saved' && event.greatFlow && !dependencies.muted()) {
      motionKey.value += 1
    }
  }

  function restore(input: { active: boolean, paused: boolean, latestJourneyMood?: string }) {
    currentEvent.value = input.active
      ? input.paused ? { type: 'session-paused' } : { type: 'session-started' }
      : { type: 'ready', recentMood: normalizeBreezyMood(input.latestJourneyMood) }
    announceCurrentEvent.value = false
  }

  function dismissNudge(nudgeId: string, input: { active: boolean, paused: boolean, latestJourneyMood?: string }) {
    if (!('nudgeId' in currentEvent.value) || currentEvent.value.nudgeId !== nudgeId) return false
    restore(input)
    return true
  }

  return {
    presentation,
    motionKey: readonly(motionKey),
    dismissNudge,
    publish,
    restore
  }
}
