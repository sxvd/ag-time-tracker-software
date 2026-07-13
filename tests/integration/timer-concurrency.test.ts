import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { startEntry } from '../../backend/utils/store'
import {
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('active timer database constraint', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('allows only one active entry when start requests race', async () => {
    const user = await createUser({ id: 'timer-user', email: 'timer@airgradient.com', displayName: 'Timer User' })
    const task = await createTaskFixture({ id: 'timer-task', ownerId: user.id })

    const results = await Promise.allSettled([
      startEntry({ taskId: task.id, userId: user.id }),
      startEntry({ taskId: task.id, userId: user.id })
    ])

    const activeEntries = await integrationPrisma.timeEntry.findMany({
      where: { userId: user.id, endedAt: null }
    })
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    expect(activeEntries).toHaveLength(1)
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ statusCode: 409 })
  })

  it('rejects a second active row even when application preflight is bypassed', async () => {
    const user = await createUser({ id: 'constraint-user', email: 'constraint@airgradient.com', displayName: 'Constraint User' })
    const task = await createTaskFixture({ id: 'constraint-task', ownerId: user.id })
    await integrationPrisma.timeEntry.create({
      data: {
        id: 'active-one',
        userId: user.id,
        taskId: task.id,
        startedAt: new Date(),
        durationSeconds: 0
      }
    })

    await expect(integrationPrisma.timeEntry.create({
      data: {
        id: 'active-two',
        userId: user.id,
        taskId: task.id,
        startedAt: new Date(),
        durationSeconds: 0
      }
    })).rejects.toMatchObject({ code: 'P2002' })
  })
})
