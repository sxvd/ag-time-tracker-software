import { beforeEach, describe, expect, it, vi } from 'vitest'

const { create, findUnique, publicState, setSessionCookie } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  publicState: vi.fn(),
  setSessionCookie: vi.fn()
}))

vi.mock('../../backend/utils/prisma', () => ({
  prisma: {
    user: {
      create,
      findUnique
    }
  }
}))

vi.mock('../../backend/utils/store', () => ({
  publicState
}))

vi.mock('../../backend/utils/auth', () => ({
  canCreateAccount: (enabled: boolean) => enabled,
  hashPassword: vi.fn(async () => 'scrypt$salt$hash'),
  passwordPolicyError: (password: string) => password.length < 8 ? 'Password must be at least 8 characters.' : '',
  setSessionCookie,
  verifyPassword: vi.fn(async () => true)
}))

describe('session password policy', () => {
  let requestBody: Record<string, unknown>

  beforeEach(() => {
    vi.resetModules()
    create.mockReset()
    publicState.mockReset()
    setSessionCookie.mockReset()
    findUnique.mockReset()
    findUnique.mockResolvedValue(null)
    create.mockImplementation(async ({ data }) => ({ id: 'new-user-id', ...data }))
    publicState.mockResolvedValue({ user: { id: 'new-user-id', email: 'new.person@airgradient.com', displayName: 'New Person', team: 'Research' } })
    setSessionCookie.mockResolvedValue('session-token')
    requestBody = {
      email: 'mog@airgradient.com',
      password: '1234567',
      mode: 'sign-in'
    }
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('readBody', async () => requestBody)
    vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => (
      Object.assign(new Error(input.statusMessage), input)
    ))
    vi.stubGlobal('useRuntimeConfig', () => ({ allowSelfRegistration: 'false' }))
  })

  it('rejects a seven-character password before looking up an existing account', async () => {
    const handler = (await import('../../backend/api/session.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters.'
    })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('does not create a missing account from sign-in mode', async () => {
    requestBody = {
      email: 'new.person@airgradient.com',
      password: 'password-123',
      mode: 'sign-in'
    }
    const handler = (await import('../../backend/api/session.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 401,
      statusMessage: 'Invalid email or password.'
    })
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'new.person@airgradient.com' } })
  })

  it('requires explicit registration availability for a missing account', async () => {
    requestBody = {
      email: 'new.person@airgradient.com',
      password: 'password-123',
      mode: 'register'
    }
    const handler = (await import('../../backend/api/session.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Registration is currently unavailable.'
    })
  })

  it('creates an explicit registration with the submitted name and canonical team', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ allowSelfRegistration: 'true' }))
    requestBody = {
      email: 'new.person@airgradient.com',
      password: 'password-123',
      mode: 'register',
      displayName: 'New Person',
      team: 'Research'
    }
    const handler = (await import('../../backend/api/session.post')).default

    const response = await handler({} as never)

    expect(create).toHaveBeenCalledWith({
      data: {
        email: 'new.person@airgradient.com',
        displayName: 'New Person',
        team: 'Research',
        passwordHash: 'scrypt$salt$hash'
      }
    })
    expect(response).toMatchObject({ sessionToken: 'session-token' })
  })

  it('rejects registration without a valid canonical team', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ allowSelfRegistration: 'true' }))
    requestBody = {
      email: 'new.person@airgradient.com',
      password: 'password-123',
      mode: 'register',
      displayName: 'New Person',
      team: 'Legacy'
    }
    const handler = (await import('../../backend/api/session.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'team must be one of: Software, Hardware, Firmware, Communication, Research, Commerce, Production, Other.'
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects an unknown authentication mode before account lookup', async () => {
    requestBody = {
      email: 'mog@airgradient.com',
      password: 'password-123',
      mode: 'reset-password'
    }
    const handler = (await import('../../backend/api/session.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Choose sign in or register.'
    })
    expect(findUnique).not.toHaveBeenCalled()
  })
})
