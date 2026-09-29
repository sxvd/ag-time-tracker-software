import { describe, expect, it } from 'vitest'
import { validateSessionSecret } from '../../backend/utils/auth'

describe('session configuration security', () => {
  it('rejects missing, default, and short production secrets', () => {
    expect(() => validateSessionSecret('', 'production')).toThrow(/session secret/i)
    expect(() => validateSessionSecret('dev-session-secret-change-me', 'production')).toThrow(/session secret/i)
    expect(() => validateSessionSecret('too-short', 'production')).toThrow(/session secret/i)
  })

  it('accepts a long production secret and development fallback', () => {
    expect(validateSessionSecret('a-secure-session-secret-with-32-chars', 'production')).toBe('a-secure-session-secret-with-32-chars')
    expect(validateSessionSecret('', 'development')).toBe('dev-session-secret-change-me')
  })
})
