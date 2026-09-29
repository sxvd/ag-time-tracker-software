import { describe, expect, it } from 'vitest'
import { passwordPolicyError } from '../../backend/utils/auth'

describe('password policy', () => {
  it('rejects seven characters and accepts eight', () => {
    expect(passwordPolicyError('1234567')).toMatch(/8 characters/i)
    expect(passwordPolicyError('12345678')).toBeNull()
  })

  it('accepts a 64-character password', () => {
    expect(passwordPolicyError('a'.repeat(64))).toBeNull()
  })
})
