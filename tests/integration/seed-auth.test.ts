import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { verifyPassword } from '../../backend/utils/auth'
import { disconnectTestDatabase, integrationPrisma, resetTestDatabase } from './helpers/database'

const execFileAsync = promisify(execFile)

describe('seeded authentication', () => {
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('creates a seeded user with a policy-compliant password and salted hash', async () => {
    await execFileAsync('node', ['backend/prisma/seed.mjs'], {
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL
      }
    })

    const user = await integrationPrisma.user.findUniqueOrThrow({
      where: { email: 'siri@airgradient.com' }
    })

    expect(await verifyPassword('demo-password', user.passwordHash)).toBe(true)
    expect(user.passwordHash).toMatch(/^scrypt\$[^$]+\$[^$]+$/)
    expect(user.passwordHash).not.toContain('demo-password')
  })
})
