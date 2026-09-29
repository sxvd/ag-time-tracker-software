import { describe, expect, it } from 'vitest'
import { canCreateAccount } from '../../backend/utils/auth'

describe('account provisioning policy', () => {
  it('honors the resolved self-registration switch in every runtime', () => {
    expect(canCreateAccount(false)).toBe(false)
    expect(canCreateAccount(true)).toBe(true)
  })
})
