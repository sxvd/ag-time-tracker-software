import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccountSettingsInput } from '../../shared/types/account-settings'

const mocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn(),
  parseAccountSettingsInput: vi.fn(),
  updateAccountSettings: vi.fn(),
  publicState: vi.fn(),
  readBody: vi.fn()
}))

vi.mock('../../backend/utils/auth', () => ({ requireSessionUser: mocks.requireSessionUser }))
vi.mock('../../backend/utils/account-settings', () => ({ parseAccountSettingsInput: mocks.parseAccountSettingsInput }))
vi.mock('../../backend/utils/store', () => ({
  updateAccountSettings: mocks.updateAccountSettings,
  publicState: mocks.publicState
}))

const input: AccountSettingsInput = {
  profile: { displayName: 'Mog', team: 'Software' },
  settings: {
    idleThresholdMinutes: 5,
    nudgeCadenceMinutes: 50,
    breezyVerbosity: 'gentle',
    muted: false,
    locationEnabled: false,
    activityEnabled: true,
    locationLabels: []
  }
}

let handler: typeof import('../../backend/api/account-settings.patch')['default']

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (candidate: typeof handler) => candidate)
  vi.stubGlobal('readBody', mocks.readBody)
  handler = (await import('../../backend/api/account-settings.patch')).default
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('combined account settings route', () => {
  it('stops before parsing or mutation when authentication fails', async () => {
    const unauthorized = Object.assign(new Error('Authentication required.'), { statusCode: 401 })
    mocks.requireSessionUser.mockRejectedValue(unauthorized)

    await expect(handler({} as never)).rejects.toBe(unauthorized)
    expect(mocks.readBody).not.toHaveBeenCalled()
    expect(mocks.parseAccountSettingsInput).not.toHaveBeenCalled()
    expect(mocks.updateAccountSettings).not.toHaveBeenCalled()
  })

  it('uses the session user instead of a browser-supplied user ID', async () => {
    const body = { userId: 'attacker-selected-user', profile: {}, settings: {} }
    const state = { user: { id: 'session-user' } }
    mocks.requireSessionUser.mockResolvedValue({ id: 'session-user' })
    mocks.readBody.mockResolvedValue(body)
    mocks.parseAccountSettingsInput.mockReturnValue(input)
    mocks.publicState.mockResolvedValue(state)

    await expect(handler({} as never)).resolves.toBe(state)
    expect(mocks.parseAccountSettingsInput).toHaveBeenCalledWith(body)
    expect(mocks.updateAccountSettings).toHaveBeenCalledWith('session-user', input)
    expect(mocks.publicState).toHaveBeenCalledWith('session-user')
  })
})
