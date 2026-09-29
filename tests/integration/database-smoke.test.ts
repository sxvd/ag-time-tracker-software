import { afterAll, describe, expect, it } from 'vitest'
import { assertTestDatabase, disconnectTestDatabase, integrationPrisma } from './helpers/database'

describe('PostgreSQL integration harness', () => {
  it('rejects a database URL not explicitly named as a test database', () => {
    expect(() => assertTestDatabase('postgresql://postgres:postgres@localhost/ag_time_tracker')).toThrow(/test database/i)
  })

  it('accepts the disposable integration database', () => {
    expect(() => assertTestDatabase('postgresql://postgres:postgres@localhost/ag_time_tracker_test')).not.toThrow()
  })

  it('reads from the migrated PostgreSQL test database', async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL || '')
    const rows = await integrationPrisma.$queryRaw<Array<{ value: number }>>`SELECT 1 AS value`
    expect(rows).toEqual([{ value: 1 }])
  })
})

afterAll(disconnectTestDatabase)
