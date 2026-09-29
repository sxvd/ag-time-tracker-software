const fallbackMessage = 'Could not sign in. Please try again.'

const safeMessages = new Set([
  'Use an AirGradient work email.',
  'Password is required.',
  'Password must be at least 8 characters.',
  'Password is too long.',
  'Invalid email or password.',
  'Account is not provisioned.'
])

interface AuthErrorEnvelope {
  statusMessage?: unknown
  data?: { statusMessage?: unknown }
  response?: { _data?: { statusMessage?: unknown } }
}

export function signInErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return fallbackMessage

  const envelope = error as AuthErrorEnvelope
  const message = [
    envelope.data?.statusMessage,
    envelope.response?._data?.statusMessage,
    envelope.statusMessage
  ].find((candidate): candidate is string => typeof candidate === 'string')

  return message && safeMessages.has(message) ? message : fallbackMessage
}
