import { describe, expect, it } from 'vitest'
import { normalizeBreezyMood, resolveBreezyPresentation } from '../../frontend/features/breezy/breezyRuntime'

describe('Breezy presentation runtime', () => {
  it.each([
    ['ready', { type: 'ready' }, 'idle', 'Ready when you are', 'Start your first task. Breezy is ready when you are.', 'ready', false, true],
    ['task-required', { type: 'task-required' }, 'idle', 'Choose a task', '', 'ready', false, false],
    ['session-started', { type: 'session-started' }, 'happy', 'Focus in progress', 'You are in the zone, keep going.', 'focus', false, true],
    ['session-paused', { type: 'session-paused' }, 'sipping-water', 'Taking a break', 'Your timer is paused. Take a breath or grab some water.', 'break', false, true],
    ['session-resumed', { type: 'session-resumed' }, 'happy', 'Focus in progress', 'Back at it, gently.', 'focus', false, true],
    ['idle-returned', { type: 'idle-returned' }, 'waving', 'Welcome back', 'Welcome back. Choose how to record the inactive time.', 'ready', false, true],
    ['idle-saved keep', { type: 'idle-saved', decision: 'keep' }, 'happy', 'Time saved', 'Inactive time was kept in your session.', 'focus', false, true],
    ['idle-saved discard', { type: 'idle-saved', decision: 'discard' }, 'happy', 'Time updated', 'Inactive time was removed from your session.', 'focus', false, true],
    ['idle-saved break', { type: 'idle-saved', decision: 'break' }, 'sipping-water', 'Break recorded', 'Your break was recorded. Welcome back.', 'break', false, true],
    ['session-saved', { type: 'session-saved', greatFlow: false }, 'happy', 'Session saved', 'Your session is saved. Nice work.', 'celebrate', false, true],
    ['manual-entry-saved', { type: 'manual-entry-saved' }, 'happy', 'Manual entry saved', '', 'ready', false, false],
    ['entry-updated', { type: 'entry-updated' }, 'happy', 'Entry updated', '', 'ready', false, false],
    ['invitation-sent', { type: 'invitation-sent' }, 'waving', 'Invitation sent', '', 'ready', false, false],
    ['invitation-accepted', { type: 'invitation-accepted' }, 'happy', 'Shared task joined', '', 'focus', false, false]
  ] as const)('maps %s to its gentle presentation', (_name, event, mood, label, message, imagePool, celebrate, announce) => {
    expect(resolveBreezyPresentation({ event, verbosity: 'gentle', muted: false })).toMatchObject({
      mood,
      label,
      message,
      imagePool,
      announce,
      celebrate,
      dismissibleNudgeId: null
    })
  })

  it.each([
    [{ type: 'task-required' }, 'Add a task name first, then start tracking.'],
    [{ type: 'manual-entry-saved' }, 'Manual entry added and clearly marked.'],
    [{ type: 'entry-updated' }, 'Entry updated. Its history and daily rollups were refreshed.'],
    [{ type: 'invitation-sent' }, 'Task invitation sent.'],
    [{ type: 'invitation-accepted' }, 'Shared task joined. You can track your contribution now.']
  ] as const)('reserves %s confirmation copy for chatty mode', (event, conciseMessage) => {
    expect(resolveBreezyPresentation({ event, verbosity: 'gentle', muted: false })).toMatchObject({
      message: '',
      announce: false
    })
    expect(resolveBreezyPresentation({ event, verbosity: 'chatty', muted: false })).toMatchObject({
      message: `${conciseMessage} Settle in and take it one step at a time.`,
      announce: true
    })
  })

  it('shows the locked paused-session copy', () => {
    expect(resolveBreezyPresentation({
      event: { type: 'session-paused' },
      verbosity: 'gentle',
      muted: false
    })).toMatchObject({
      mood: 'sipping-water',
      label: 'Taking a break',
      message: 'Your timer is paused. Take a breath or grab some water.',
      announce: true,
      celebrate: false,
      dismissibleNudgeId: null
    })
  })

  it.each([
    ['long-focus', { type: 'long-focus', nudgeId: 'nudge-focus', message: 'You are in the zone, keep going.' }, 'focus'],
    ['hydration', { type: 'hydration', nudgeId: 'nudge-1', message: 'A sip of water could be a good reset.' }, 'break'],
    ['ventilation', { type: 'ventilation', nudgeId: 'nudge-air', message: 'A little fresh air could help.' }, 'air']
  ] as const)('uses the server-provided message for the %s nudge', (_name, event, imagePool) => {
    expect(resolveBreezyPresentation({ event, verbosity: 'gentle', muted: false })).toMatchObject({
      mood: 'happy',
      label: 'Focus in progress',
      message: event.message,
      imagePool,
      announce: true,
      celebrate: false,
      dismissibleNudgeId: event.nudgeId
    })
  })

  it('keeps quiet nudge delivery unobtrusive', () => {
    expect(resolveBreezyPresentation({
      event: { type: 'hydration', nudgeId: 'nudge-1', message: 'A sip of water could be a good reset.' },
      verbosity: 'quiet',
      muted: false
    })).toMatchObject({ label: 'Focus in progress', message: '', announce: false, dismissibleNudgeId: null })
  })

  it('does not rewrite persisted nudge copy for chatty delivery', () => {
    expect(resolveBreezyPresentation({
      event: { type: 'ventilation', nudgeId: 'nudge-air', message: 'A little fresh air could help.' },
      verbosity: 'chatty',
      muted: false
    })).toMatchObject({ message: 'A little fresh air could help.', announce: true })
  })

  it('uses each verbosity level to control nonessential copy', () => {
    const input = { event: { type: 'session-started' } as const, muted: false }

    expect(resolveBreezyPresentation({ ...input, verbosity: 'quiet' })).toMatchObject({ message: '', announce: false })
    expect(resolveBreezyPresentation({ ...input, verbosity: 'gentle' })).toMatchObject({ message: 'You are in the zone, keep going.', announce: true })
    expect(resolveBreezyPresentation({ ...input, verbosity: 'chatty' })).toMatchObject({ message: 'You are in the zone, keep going. Settle in and take it one step at a time.', announce: true })
  })

  it('gives a Great flow session a celebration only when Breezy is not muted', () => {
    expect(resolveBreezyPresentation({
      event: { type: 'session-saved', greatFlow: true },
      verbosity: 'gentle',
      muted: false
    })).toMatchObject({
      mood: 'cheering',
      label: 'Great flow',
      message: 'Great flow. You found a strong rhythm today.',
      imagePool: 'celebrate',
      announce: true,
      celebrate: true
    })
  })

  it('lets mute take precedence over a Great flow celebration', () => {
    expect(resolveBreezyPresentation({
      event: { type: 'session-saved', greatFlow: true },
      verbosity: 'gentle',
      muted: true
    })).toMatchObject({ label: 'Breezy is muted', message: '', announce: false, celebrate: false })
  })

  it('uses a recent Journey mood for the ready presentation without exposing raw mood labels', () => {
    expect(resolveBreezyPresentation({
      event: { type: 'ready', recentMood: 'clear-skies' },
      verbosity: 'gentle',
      muted: false
    })).toMatchObject({ mood: 'happy', label: 'Ready when you are', message: 'Start your first task. Breezy is ready when you are.' })
  })

  it.each([
    ['idle', 'idle'],
    ['happy', 'happy'],
    ['cheering', 'cheering'],
    ['waving', 'waving'],
    ['sipping water', 'sipping-water'],
    ['Sipping-water', 'sipping-water'],
    ['sleepy', 'sleepy'],
    ['clear-skies', 'happy'],
    ['hazy', 'sleepy'],
    ['unknown legacy mood', 'idle'],
    [null, 'idle']
  ] as const)('normalizes %s to %s', (value, expected) => {
    expect(normalizeBreezyMood(value)).toBe(expected)
  })
})
