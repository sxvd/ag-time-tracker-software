import type { BreezyImagePool } from './mascotCatalog'

export type BreezyVerbosity = 'quiet' | 'gentle' | 'chatty'
export type BreezyMood = 'idle' | 'happy' | 'cheering' | 'waving' | 'sipping-water' | 'sleepy'
export type BreezyEvent =
  | { type: 'ready'; recentMood?: string }
  | { type: 'task-required' }
  | { type: 'session-started' }
  | { type: 'session-paused' }
  | { type: 'session-resumed' }
  | { type: 'idle-returned' }
  | { type: 'idle-saved'; decision: 'keep' | 'discard' | 'break' }
  | { type: 'session-saved'; greatFlow: boolean }
  | { type: 'manual-entry-saved' }
  | { type: 'entry-updated' }
  | { type: 'invitation-sent' | 'invitation-accepted' }
  | { type: 'long-focus'; nudgeId: string; message: string }
  | { type: 'hydration'; nudgeId: string; message: string }
  | { type: 'ventilation'; nudgeId: string; message: string }

export interface BreezyPresentation {
  mood: BreezyMood
  label: string
  message: string
  imagePool: BreezyImagePool
  announce: boolean
  celebrate: boolean
  dismissibleNudgeId: string | null
}

type UnmutedPresentation = Omit<BreezyPresentation, 'announce'>

export function resolveBreezyPresentation(input: {
  event: BreezyEvent
  verbosity: BreezyVerbosity
  muted: boolean
}): BreezyPresentation {
  const presentation = resolveUnmutedPresentation(input.event)

  if (input.muted) {
    return {
      mood: 'idle',
      label: 'Breezy is muted',
      message: '',
      imagePool: 'quiet',
      announce: false,
      celebrate: false,
      dismissibleNudgeId: null
    }
  }

  if (input.verbosity === 'quiet') {
    return { ...presentation, message: '', announce: false, celebrate: false, dismissibleNudgeId: null }
  }

  if (input.verbosity === 'gentle' && isChattyOnlyConfirmation(input.event)) {
    return { ...presentation, message: '', announce: false }
  }

  return {
    ...presentation,
    message: input.verbosity === 'chatty' && !presentation.dismissibleNudgeId
      ? chattyMessage(presentation.message)
      : presentation.message,
    announce: true
  }
}

function isChattyOnlyConfirmation(event: BreezyEvent): boolean {
  return event.type === 'task-required'
    || event.type === 'manual-entry-saved'
    || event.type === 'entry-updated'
    || event.type === 'invitation-sent'
    || event.type === 'invitation-accepted'
}

export function normalizeBreezyMood(value: unknown): BreezyMood {
  if (typeof value !== 'string') return 'idle'

  switch (value.trim().toLowerCase().replace(/[_\s]+/g, '-')) {
    case 'idle': return 'idle'
    case 'happy':
    case 'clear-skies':
    case 'clear': return 'happy'
    case 'cheering': return 'cheering'
    case 'waving': return 'waving'
    case 'sipping-water': return 'sipping-water'
    case 'sleepy':
    case 'hazy': return 'sleepy'
    default: return 'idle'
  }
}

function resolveUnmutedPresentation(event: BreezyEvent): UnmutedPresentation {
  switch (event.type) {
    case 'ready':
      return presentation(normalizeBreezyMood(event.recentMood), 'Ready when you are', 'Start your first task. Breezy is ready when you are.', 'ready')
    case 'task-required':
      return presentation('idle', 'Choose a task', 'Add a task name first, then start tracking.', 'ready')
    case 'session-started':
      return presentation('happy', 'Focus in progress', 'You are in the zone, keep going.', 'focus')
    case 'session-paused':
      return presentation('sipping-water', 'Taking a break', 'Your timer is paused. Take a breath or grab some water.', 'break')
    case 'session-resumed':
      return presentation('happy', 'Focus in progress', 'Back at it, gently.', 'focus')
    case 'idle-returned':
      return presentation('waving', 'Welcome back', 'Welcome back. Choose how to record the inactive time.', 'ready')
    case 'idle-saved':
      return idleSavedPresentation(event.decision)
    case 'session-saved':
      return event.greatFlow
        ? presentation('cheering', 'Great flow', 'Great flow. You found a strong rhythm today.', 'celebrate', true)
        : presentation('happy', 'Session saved', 'Your session is saved. Nice work.', 'celebrate')
    case 'manual-entry-saved':
      return presentation('happy', 'Manual entry saved', 'Manual entry added and clearly marked.', 'ready')
    case 'entry-updated':
      return presentation('happy', 'Entry updated', 'Entry updated. Its history and daily rollups were refreshed.', 'ready')
    case 'invitation-sent':
      return presentation('waving', 'Invitation sent', 'Task invitation sent.', 'ready')
    case 'invitation-accepted':
      return presentation('happy', 'Shared task joined', 'Shared task joined. You can track your contribution now.', 'focus')
    case 'long-focus':
      return nudgePresentation(event, 'focus')
    case 'hydration':
      return nudgePresentation(event, 'break')
    case 'ventilation':
      return nudgePresentation(event, 'air')
    default:
      return assertNever(event)
  }
}

function idleSavedPresentation(decision: 'keep' | 'discard' | 'break'): UnmutedPresentation {
  switch (decision) {
    case 'keep': return presentation('happy', 'Time saved', 'Inactive time was kept in your session.', 'focus')
    case 'discard': return presentation('happy', 'Time updated', 'Inactive time was removed from your session.', 'focus')
    case 'break': return presentation('sipping-water', 'Break recorded', 'Your break was recorded. Welcome back.', 'break')
    default: return assertNever(decision)
  }
}

function nudgePresentation(event: Extract<BreezyEvent, { nudgeId: string }>, imagePool: BreezyImagePool): UnmutedPresentation {
  return presentation('happy', 'Focus in progress', event.message, imagePool, false, event.nudgeId)
}

function presentation(mood: BreezyMood, label: string, message: string, imagePool: BreezyImagePool, celebrate = false, dismissibleNudgeId: string | null = null): UnmutedPresentation {
  return { mood, label, message, imagePool, celebrate, dismissibleNudgeId }
}

function chattyMessage(message: string): string {
  return `${message} Settle in and take it one step at a time.`
}

function assertNever(value: never): never {
  throw new Error(`Unexpected Breezy event: ${JSON.stringify(value)}`)
}
