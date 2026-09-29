import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn(),
  claimDueBreezyNudge: vi.fn(),
  acknowledgeBreezyNudge: vi.fn(),
  requiredString: vi.fn(),
  readBody: vi.fn(),
  getRouterParam: vi.fn()
}))

vi.mock('../../backend/utils/auth', () => ({ requireSessionUser: mocks.requireSessionUser }))
vi.mock('../../backend/utils/breezy-nudges', () => ({
  claimDueBreezyNudge: mocks.claimDueBreezyNudge,
  acknowledgeBreezyNudge: mocks.acknowledgeBreezyNudge
}))
vi.mock('../../backend/utils/validation', () => ({ requiredString: mocks.requiredString }))

let claimHandler: typeof import('../../backend/api/breezy-nudges/claim.post')['default']
let acknowledgeHandler: typeof import('../../backend/api/breezy-nudges/[id].patch')['default']

beforeAll(async () => {
  vi.stubGlobal('defineEventHandler', (candidate: typeof claimHandler) => candidate)
  vi.stubGlobal('readBody', mocks.readBody)
  vi.stubGlobal('getRouterParam', mocks.getRouterParam)
  claimHandler = (await import('../../backend/api/breezy-nudges/claim.post')).default
  acknowledgeHandler = (await import('../../backend/api/breezy-nudges/[id].patch')).default
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireSessionUser.mockResolvedValue({ id: 'session-user' })
})

describe('Breezy nudge routes', () => {
  it('claims for the session user and validates only the entry ID', async () => {
    const nudge = { id: 'nudge-1' }
    mocks.readBody.mockResolvedValue({ entryId: ' entry-1 ', userId: 'attacker-user' })
    mocks.requiredString.mockReturnValue('entry-1')
    mocks.claimDueBreezyNudge.mockResolvedValue(nudge)

    await expect(claimHandler({} as never)).resolves.toEqual({ nudge })

    expect(mocks.requiredString).toHaveBeenCalledWith('entryId', ' entry-1 ', { max: 128 })
    expect(mocks.claimDueBreezyNudge).toHaveBeenCalledWith('session-user', 'entry-1')
    expect(mocks.claimDueBreezyNudge).not.toHaveBeenCalledWith('attacker-user', expect.anything())
  })

  it('does not read or claim when authentication fails', async () => {
    const unauthorized = Object.assign(new Error('Authentication required.'), { statusCode: 401 })
    mocks.requireSessionUser.mockRejectedValue(unauthorized)

    await expect(claimHandler({} as never)).rejects.toBe(unauthorized)
    expect(mocks.readBody).not.toHaveBeenCalled()
    expect(mocks.claimDueBreezyNudge).not.toHaveBeenCalled()
  })

  it('acknowledges the route nudge ID for the session user and ignores the body', async () => {
    const nudge = { id: 'nudge-2' }
    mocks.getRouterParam.mockReturnValue('nudge-2')
    mocks.acknowledgeBreezyNudge.mockResolvedValue(nudge)

    await expect(acknowledgeHandler({ body: { id: 'other', userId: 'attacker-user' } } as never))
      .resolves.toEqual({ nudge })

    expect(mocks.readBody).not.toHaveBeenCalled()
    expect(mocks.acknowledgeBreezyNudge).toHaveBeenCalledWith('session-user', 'nudge-2')
  })
})
