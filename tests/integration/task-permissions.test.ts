import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { acceptTaskInvitation, publicState, shareTask } from '../../backend/utils/store'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('shared task permissions', () => {
  beforeAll(() => {
    vi.stubGlobal('createError', createError)
  })

  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('does not expose shared entries to a pending invitee', async () => {
    const fixtures = await createPermissionFixtures()

    const pendingState = await publicState(fixtures.pending.id)
    const memberState = await publicState(fixtures.member.id)
    const unrelatedState = await publicState(fixtures.unrelated.id)

    expect(pendingState.taskInvitations).toContainEqual(expect.objectContaining({
      id: fixtures.invitation.id,
      status: 'pending'
    }))
    expect(pendingState.tasks).toContainEqual(expect.objectContaining({ id: fixtures.task.id }))
    expect(pendingState.entries).not.toContainEqual(expect.objectContaining({ taskId: fixtures.task.id }))
    expect(memberState.entries).toContainEqual(expect.objectContaining({ taskId: fixtures.task.id }))
    expect(unrelatedState.tasks).not.toContainEqual(expect.objectContaining({ id: fixtures.task.id }))
    expect(unrelatedState.entries).not.toContainEqual(expect.objectContaining({ taskId: fixtures.task.id }))
    expect(pendingState.users[0]).not.toHaveProperty('email')
  })

  it('allows only the task owner to invite collaborators', async () => {
    const fixtures = await createPermissionFixtures()

    await expect(shareTask({
      taskId: fixtures.task.id,
      senderId: fixtures.member.id,
      recipientIds: [fixtures.unrelated.id]
    })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('does not accept an invitation after it leaves pending status', async () => {
    const fixtures = await createPermissionFixtures()
    await integrationPrisma.taskInvite.update({
      where: { id: fixtures.invitation.id },
      data: { status: 'accepted', respondedAt: new Date() }
    })

    await expect(acceptTaskInvitation({
      invitationId: fixtures.invitation.id,
      userId: fixtures.pending.id
    })).rejects.toMatchObject({ statusCode: 404 })
  })
})

async function createPermissionFixtures() {
  const owner = await createUser({ id: 'owner', email: 'owner@airgradient.com', displayName: 'Owner' })
  const member = await createUser({ id: 'member', email: 'member@airgradient.com', displayName: 'Member' })
  const pending = await createUser({ id: 'pending', email: 'pending@airgradient.com', displayName: 'Pending' })
  const unrelated = await createUser({ id: 'unrelated', email: 'unrelated@airgradient.com', displayName: 'Unrelated' })
  const task = await createTaskFixture({ id: 'shared-task', ownerId: owner.id, memberIds: [member.id] })
  await createEntryFixture({ id: 'owner-entry', userId: owner.id, taskId: task.id })
  const invitation = await integrationPrisma.taskInvite.create({
    data: {
      id: 'pending-invitation',
      taskId: task.id,
      senderId: owner.id,
      recipientId: pending.id,
      status: 'pending'
    }
  })

  return { owner, member, pending, unrelated, task, invitation }
}
