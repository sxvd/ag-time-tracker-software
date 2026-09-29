import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn(),
  updateSettings: vi.fn(),
  publicState: vi.fn(),
  readBody: vi.fn()
}))

vi.mock('../../backend/utils/auth', () => ({ requireSessionUser: mocks.requireSessionUser }))
vi.mock('../../backend/utils/store', () => ({
  updateSettings: mocks.updateSettings,
  publicState: mocks.publicState
}))

let handler: typeof import('../../backend/api/settings.patch')['default']

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (candidate: typeof handler) => candidate)
  vi.stubGlobal('readBody', mocks.readBody)
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
  handler = (await import('../../backend/api/settings.patch')).default
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('legacy settings route', () => {
  it('persists only current Activity & Privacy fields and ignores hidden Breezy overrides', async () => {
    const state = { user: { id: 'session-user' } }
    mocks.requireSessionUser.mockResolvedValue({ id: 'session-user' })
    mocks.readBody.mockResolvedValue({
      settings: {
        idleThresholdMinutes: 10,
        nudgeCadenceMinutes: 1_440,
        breezyVerbosity: 'quiet',
        muted: true,
        locationEnabled: true,
        activityEnabled: false,
        locationLabels: ['Home office']
      }
    })
    mocks.publicState.mockResolvedValue(state)

    await expect(handler({} as never)).resolves.toBe(state)

    expect(mocks.updateSettings).toHaveBeenCalledWith('session-user', {
      idleThresholdMinutes: 10,
      locationEnabled: true,
      activityEnabled: false,
      locationLabels: ['Home office']
    })
    expect(mocks.publicState).toHaveBeenCalledWith('session-user')
  })
})
