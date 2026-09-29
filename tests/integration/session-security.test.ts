import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { revokeSession } from '../../backend/utils/auth'
import {
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('session persistence security', () => {
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('revokes only the current session', async () => {
    const user = await createUser({ id: 'session-user', email: 'session@airgradient.com', displayName: 'Session User' })
    const expiresAt = new Date(Date.now() + 60_000)
    await integrationPrisma.authSession.createMany({
      data: [
        { id: 'session-a', userId: user.id, tokenHash: 'hash-a', expiresAt },
        { id: 'session-b', userId: user.id, tokenHash: 'hash-b', expiresAt }
      ]
    })

    await revokeSession('session-a')

    const sessions = await integrationPrisma.authSession.findMany({ orderBy: { id: 'asc' } })
    expect(sessions[0].revokedAt).toBeInstanceOf(Date)
    expect(sessions[1].revokedAt).toBeNull()
  })
})
