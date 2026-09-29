import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { publicState } from '../../backend/utils/store'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('personal dashboard total duration', () => {
  beforeEach(resetTestDatabase)

  it('returns exact seconds for the signed-in user alongside rounded chart hours', async () => {
    const owner = await createUser({
      id: 'dashboard-duration-owner',
      email: 'dashboard-duration-owner@airgradient.com',
      displayName: 'Duration Owner'
    })
    const other = await createUser({
      id: 'dashboard-duration-other',
      email: 'dashboard-duration-other@airgradient.com',
      displayName: 'Other User'
    })
    const ownerTask = await createTaskFixture({ id: 'dashboard-duration-task', ownerId: owner.id })
    const otherTask = await createTaskFixture({ id: 'dashboard-duration-other-task', ownerId: other.id })
    const ownerEntry = await createEntryFixture({ id: 'dashboard-duration-entry', userId: owner.id, taskId: ownerTask.id })
    const otherEntry = await createEntryFixture({ id: 'dashboard-duration-other-entry', userId: other.id, taskId: otherTask.id })

    await integrationPrisma.timeEntry.update({ where: { id: ownerEntry.id }, data: { durationSeconds: 33779 } })
    await integrationPrisma.timeEntry.update({ where: { id: otherEntry.id }, data: { durationSeconds: 7200 } })

    const state = await publicState(owner.id)

    expect(state.dashboards.personal.totalSeconds).toBe(33779)
    expect(state.dashboards.personal.totalHours).toBe(9.4)
    expect(state.dashboards.personal.weeks).toEqual([expect.objectContaining({
      weekStart: '2026-07-13',
      weekEnd: '2026-07-19',
      totalSeconds: 33779,
      days: expect.arrayContaining([
        expect.objectContaining({
          label: 'Mon 13',
          byCategory: [expect.objectContaining({ seconds: 33779, sessions: 1 })]
        })
      ])
    })])
  })
})

afterAll(disconnectTestDatabase)
