import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { useBreezyRuntime } from '../../frontend/features/breezy/useBreezyRuntime'

describe('Breezy event runtime coordination', () => {
  it('starts in a silent ready state', () => {
    const runtime = createRuntime()

    expect(runtime.presentation.value).toMatchObject({
      mood: 'idle',
      label: 'Ready when you are',
      announce: false
    })
    expect(runtime.motionKey.value).toBe(0)
  })

  it.each([
    [{ active: true, paused: false }, 'Focus in progress', 'happy'],
    [{ active: true, paused: true }, 'Taking a break', 'sipping-water']
  ] as const)('restores active timer state without announcing it', (input, label, mood) => {
    const runtime = createRuntime()

    runtime.restore(input)

    expect(runtime.presentation.value).toMatchObject({ label, mood, announce: false })
    expect(runtime.motionKey.value).toBe(0)
  })

  it('normalizes the latest Journey mood when restoring a ready state', () => {
    const runtime = createRuntime()

    runtime.restore({ active: false, paused: false, latestJourneyMood: 'Clear skies' })

    expect(runtime.presentation.value).toMatchObject({
      mood: 'happy',
      label: 'Ready when you are',
      announce: false
    })
  })

  it('replaces the current event with each published event', () => {
    const runtime = createRuntime()

    runtime.publish({ type: 'session-started' })
    expect(runtime.presentation.value).toMatchObject({ label: 'Focus in progress', announce: true })

    runtime.publish({ type: 'session-paused' })
    expect(runtime.presentation.value).toMatchObject({ label: 'Taking a break', announce: true })
  })

  it('gives muted settings precedence over the current event', () => {
    const preferences = reactive({ verbosity: 'gentle' as const, muted: false })
    const runtime = useBreezyRuntime({
      verbosity: () => preferences.verbosity,
      muted: () => preferences.muted
    })

    runtime.publish({ type: 'session-started' })
    preferences.muted = true

    expect(runtime.presentation.value).toMatchObject({
      label: 'Breezy is muted',
      message: '',
      announce: false,
      celebrate: false
    })
  })

  it('recomputes the current event when verbosity changes', () => {
    const preferences = reactive<{ verbosity: 'quiet' | 'gentle' | 'chatty', muted: boolean }>({
      verbosity: 'quiet',
      muted: false
    })
    const runtime = useBreezyRuntime({
      verbosity: () => preferences.verbosity,
      muted: () => preferences.muted
    })

    runtime.publish({ type: 'invitation-sent' })
    expect(runtime.presentation.value.message).toBe('')

    preferences.verbosity = 'gentle'
    expect(runtime.presentation.value).toMatchObject({ message: '', announce: false })

    preferences.verbosity = 'chatty'
    expect(runtime.presentation.value.message).toBe('Task invitation sent. Settle in and take it one step at a time.')
  })

  it('increments motion once for each unmuted Great-flow save', () => {
    const runtime = createRuntime()

    runtime.publish({ type: 'session-saved', greatFlow: true })
    expect(runtime.motionKey.value).toBe(1)

    runtime.publish({ type: 'session-saved', greatFlow: true })
    expect(runtime.motionKey.value).toBe(2)
  })

  it('does not increment motion for muted Great flow or non-celebration events', () => {
    const preferences = reactive({ verbosity: 'gentle' as const, muted: false })
    const runtime = useBreezyRuntime({
      verbosity: () => preferences.verbosity,
      muted: () => preferences.muted
    })

    runtime.publish({ type: 'session-started' })
    runtime.publish({ type: 'session-saved', greatFlow: false })
    preferences.muted = true
    runtime.publish({ type: 'session-saved', greatFlow: true })

    expect(runtime.motionKey.value).toBe(0)
  })

  it('silently restores authoritative timer state only when dismissing the current nudge', () => {
    const runtime = createRuntime()
    runtime.publish({ type: 'hydration', nudgeId: 'nudge-1', message: 'Drink water.' })

    expect(runtime.dismissNudge('nudge-1', { active: true, paused: false })).toBe(true)
    expect(runtime.presentation.value).toMatchObject({ label: 'Focus in progress', announce: false })
  })

  it('does not overwrite a newer event when an older nudge dismissal finishes late', () => {
    const runtime = createRuntime()
    runtime.publish({ type: 'hydration', nudgeId: 'nudge-1', message: 'Drink water.' })
    runtime.publish({ type: 'session-paused' })

    expect(runtime.dismissNudge('nudge-1', { active: true, paused: true })).toBe(false)
    expect(runtime.presentation.value).toMatchObject({ label: 'Taking a break', announce: true })
  })
})

function createRuntime() {
  return useBreezyRuntime({
    verbosity: () => 'gentle',
    muted: () => false
  })
}
