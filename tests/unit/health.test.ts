import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryRaw = vi.fn(async () => [{ '?column?': 1 }])

vi.mock('../../backend/utils/prisma', () => ({
  prisma: {
    $queryRaw: queryRaw
  }
}))

describe('health endpoint', () => {
  beforeEach(() => {
    queryRaw.mockClear()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  })

  it('returns ok after a database ping', async () => {
    const handler = (await import('../../backend/api/health.get')).default
    const result = await handler({} as never)

    expect(queryRaw).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      status: 'ok',
      service: 'ag-time-tracker'
    })
    expect(new Date(result.checkedAt).toString()).not.toBe('Invalid Date')
  })
})
