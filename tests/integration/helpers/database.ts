import { PrismaClient } from '@prisma/client'

function databaseUrl() {
  return process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
}

export function assertTestDatabase(value: string) {
  let databaseName = ''
  try {
    databaseName = new URL(value).pathname.replace(/^\//, '')
  } catch {
    throw new Error('Integration tests require a valid test database URL.')
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error('Integration tests require a test database name ending in _test.')
  }
}

export const integrationPrisma = new PrismaClient({
  datasources: { db: { url: databaseUrl() } }
})

export async function resetTestDatabase() {
  assertTestDatabase(databaseUrl())
  await integrationPrisma.$transaction([
    integrationPrisma.export.deleteMany(),
    integrationPrisma.breezyNudge.deleteMany(),
    integrationPrisma.userMedal.deleteMany(),
    integrationPrisma.breezyDay.deleteMany(),
    integrationPrisma.entryAuditEvent.deleteMany(),
    integrationPrisma.entryBlocker.deleteMany(),
    integrationPrisma.entryFeedback.deleteMany(),
    integrationPrisma.entryPause.deleteMany(),
    integrationPrisma.trackingPresence.deleteMany(),
    integrationPrisma.timeEntry.deleteMany(),
    integrationPrisma.taskInvite.deleteMany(),
    integrationPrisma.taskMember.deleteMany(),
    integrationPrisma.task.deleteMany(),
    integrationPrisma.project.deleteMany(),
    integrationPrisma.client.deleteMany(),
    integrationPrisma.settings.deleteMany(),
    integrationPrisma.authSession.deleteMany(),
    integrationPrisma.category.deleteMany(),
    integrationPrisma.user.deleteMany(),
    integrationPrisma.blocker.deleteMany(),
    integrationPrisma.medal.deleteMany()
  ])
}

export async function disconnectTestDatabase() {
  await integrationPrisma.$disconnect()
}

export async function createUser(input: {
  id: string
  email: string
  displayName: string
  team?: string
}) {
  return integrationPrisma.user.create({
    data: {
      ...input,
      team: input.team || 'Software',
      passwordHash: 'integration-test-only'
    }
  })
}

export async function createTaskFixture(input: {
  id: string
  ownerId: string
  title?: string
  memberIds?: string[]
}) {
  const category = await integrationPrisma.category.upsert({
    where: { id: 'test-category' },
    update: {},
    create: { id: 'test-category', name: 'Test category' }
  })
  return integrationPrisma.task.create({
    data: {
      id: input.id,
      title: input.title || 'Integration task',
      description: '',
      categoryId: category.id,
      ownerId: input.ownerId,
      isShared: Boolean(input.memberIds?.length),
      members: {
        create: [
          { userId: input.ownerId, role: 'owner', invitedByUserId: input.ownerId },
          ...(input.memberIds || []).map((userId) => ({
            userId,
            role: 'member',
            invitedByUserId: input.ownerId
          }))
        ]
      }
    }
  })
}

export async function createEntryFixture(input: {
  id: string
  userId: string
  taskId: string
  active?: boolean
  contextSwitches?: number
}) {
  return integrationPrisma.timeEntry.create({
    data: {
      id: input.id,
      userId: input.userId,
      taskId: input.taskId,
      startedAt: new Date('2026-07-13T09:00:00.000Z'),
      endedAt: input.active ? null : new Date('2026-07-13T10:00:00.000Z'),
      durationSeconds: input.active ? 0 : 3600,
      contextSwitches: input.contextSwitches || 0
    }
  })
}
