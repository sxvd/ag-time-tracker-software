import { describe, expect, it } from 'vitest'
import { signInErrorMessage } from '../../frontend/utils/auth-error'

describe('sign-in error presentation', () => {
  it.each([
    [
      { data: { statusMessage: 'Invalid email or password.' } },
      'Invalid email or password.'
    ],
    [
      { response: { _data: { statusMessage: 'Password must be at least 8 characters.' } } },
      'Password must be at least 8 characters.'
    ],
    [
      { statusMessage: 'Use an AirGradient work email.' },
      'Use an AirGradient work email.'
    ]
  ])('shows a safe authentication error returned by the API', (error, expected) => {
    expect(signInErrorMessage(error)).toBe(expected)
  })

  it('does not expose unknown server details', () => {
    expect(signInErrorMessage({
      data: { statusMessage: 'Database connection details are unavailable.' }
    })).toBe('Could not sign in. Please try again.')
  })
})
