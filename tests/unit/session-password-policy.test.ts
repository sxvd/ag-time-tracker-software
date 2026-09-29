import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn()
}))

vi.mock('../../backend/utils/prisma', () => ({
  prisma: {
    user: {
      findUnique
    }
  }
}))

vi.mock('../../backend/utils/store', () => ({
  publicState: vi.fn()
}))

describe('session password policy', () => {
  beforeEach(() => {
    findUnique.mockReset()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('readBody', async () => ({
      email: 'mog@airgradient.com',
      password: '1234567'
    }))
    vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => (
      Object.assign(new Error(input.statusMessage), input)
    ))
  })

  it('rejects a seven-character password before looking up an existing account', async () => {
    const handler = (await import('../../backend/api/session.post')).default

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters.'
    })
    expect(findUnique).not.toHaveBeenCalled()
  })
})
