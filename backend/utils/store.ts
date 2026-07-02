import { awardMedals, calculateDuration, deriveBreezyDay, toCsv } from '../../shared/utils/time'
import type { EfficiencyFeel, EnergyLevel, FlowQuality, PauseWindow } from '../../shared/utils/time'
import { prisma } from './prisma'

export interface User {
  id: string
  email: string
  displayName: string
  team: string
}

export interface TaskInput {
  title?: string
  description?: string
  categoryId?: string
  clientId?: string
  projectId?: string
  estimateMinutes?: number
  ownerId?: string
  members?: string[]
}

export interface TimeEntryInput {
  taskId?: string
  userId?: string
  startedAt?: string
  endedAt?: string
  idleSeconds?: number
  contextSwitches?: number
  locationLabel?: string
  feedback?: EntryFeedbackInput
  blockers?: string[]
}

export interface EntryFeedbackInput {
  flowQuality: FlowQuality
  efficiencyFeel: EfficiencyFeel
  energy: EnergyLevel
  note: string
}

const defaultCategories = ['Deep work', 'Meeting', 'Admin', 'Comms', 'Research', 'Other']
const defaultBlockers = ['Waiting on someone', 'Tool was slow or broke', 'Unclear requirements', 'Interruptions', 'Context switching', 'Meetings overran', 'None']
const flowValues = ['Great flow', 'Neutral', 'Friction']
const efficiencyValues = ['Felt efficient', 'Felt manual', 'Felt wasteful']
const energyValues = ['High', 'OK', 'Drained']

const defaultSettings = {
  idleThresholdMinutes: 5,
  nudgeCadenceMinutes: 90,
  breezyVerbosity: 'gentle',
  muted: false,
  locationEnabled: false,
  activityEnabled: true,
  locationLabels: ['Home office', 'AirGradient office']
}

const medalDefinitions = [
  ['flow-state', 'Flow State', 'Logged a great-flow session.'],
  ['steady-breeze', 'Steady Breeze', 'Tracked across five sessions.'],
  ['in-the-zone', 'In the Zone', 'Tracked eight honest hours.'],
  ['straight-shooter', 'Straight Shooter', 'Named a real blocker.'],
  ['sustainable-pace', 'Sustainable Pace', 'Protected rest or break time.'],
  ['single-tasker', 'Single-Tasker', 'Kept a focused session calm.'],
  ['fresh-air', 'Fresh Air', 'Opened space for a reset.'],
  ['clear-skies', 'Clear Skies', 'Finished a blocker-free day.']
] as const

function asIso(value: Date | string | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function roundHours(seconds: number) {
  return Math.round((seconds / 3600) * 10) / 10
}

function displayDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function normaliseDateInput(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function compactOptionalId(value?: string) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

function mapUser(user: { id: string, email: string, displayName: string, team: string }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    team: user.team
  }
}

function mapTask(task: {
  id: string
  title: string
  description: string
  categoryId: string
  clientId: string | null
  projectId: string | null
  estimateMinutes: number | null
  ownerId: string
  isShared: boolean
  isArchived: boolean
  createdAt: Date
  members: { userId: string }[]
}) {
  const members = [...new Set([task.ownerId, ...task.members.map((member) => member.userId)])]
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    categoryId: task.categoryId,
    clientId: task.clientId || undefined,
    projectId: task.projectId || undefined,
    estimateMinutes: task.estimateMinutes || undefined,
    ownerId: task.ownerId,
    isShared: task.isShared,
    isArchived: task.isArchived,
    createdAt: task.createdAt.toISOString(),
    members
  }
}

function mapInvitation(invitation: {
  id: string
  taskId: string
  senderId: string
  recipientId: string
  status: string
  createdAt: Date
  respondedAt: Date | null
}) {
  return {
    id: invitation.id,
    taskId: invitation.taskId,
    senderId: invitation.senderId,
    recipientId: invitation.recipientId,
    status: invitation.status as 'pending' | 'accepted',
    createdAt: invitation.createdAt.toISOString(),
    respondedAt: invitation.respondedAt?.toISOString()
  }
}

function mapEntry(entry: {
  id: string
  taskId: string
  userId: string
  startedAt: Date
  endedAt: Date | null
  durationSeconds: number
  isManual: boolean
  isEdited: boolean
  idleSeconds: number
  contextSwitches: number
  locationLabel: string | null
  createdAt: Date
  pauses: { startedAt: Date, endedAt: Date }[]
  feedback: { flowQuality: string, efficiencyFeel: string, energy: string, note: string | null } | null
  blockers: { blocker: { name: string } }[]
}) {
  return {
    id: entry.id,
    taskId: entry.taskId,
    userId: entry.userId,
    startedAt: entry.startedAt.toISOString(),
    endedAt: asIso(entry.endedAt),
    durationSeconds: entry.durationSeconds,
    isManual: entry.isManual,
    isEdited: entry.isEdited,
    idleSeconds: entry.idleSeconds,
    contextSwitches: entry.contextSwitches,
    locationLabel: entry.locationLabel || '',
    pauses: entry.pauses.map((pause) => ({
      startedAt: pause.startedAt.toISOString(),
      endedAt: pause.endedAt.toISOString()
    })),
    feedback: entry.feedback
      ? {
          flowQuality: entry.feedback.flowQuality as FlowQuality,
          efficiencyFeel: entry.feedback.efficiencyFeel as EfficiencyFeel,
          energy: entry.feedback.energy as EnergyLevel,
          note: entry.feedback.note || ''
        }
      : undefined,
    blockers: entry.blockers.map((row) => row.blocker.name),
    createdAt: entry.createdAt.toISOString()
  }
}

function validateFeedback(feedback?: EntryFeedbackInput) {
  if (!feedback) return undefined
  if (!flowValues.includes(feedback.flowQuality)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid flow quality.' })
  }
  if (!efficiencyValues.includes(feedback.efficiencyFeel)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid efficiency value.' })
  }
  if (!energyValues.includes(feedback.energy)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid energy value.' })
  }
  return {
    flowQuality: feedback.flowQuality,
    efficiencyFeel: feedback.efficiencyFeel,
    energy: feedback.energy,
    note: String(feedback.note || '')
  }
}

export function normalizeBlockers(blockers: string[] = []) {
  const cleaned = [...new Set(blockers.map((blocker) => String(blocker || '').trim()).filter(Boolean))]
  if (!cleaned.length) return ['None']
  const realBlockers = cleaned.filter((blocker) => blocker !== 'None')
  return realBlockers.length ? realBlockers : ['None']
}

export function canTrackTask(task: { ownerId: string, members: string[] }, userId: string) {
  return task.ownerId === userId || task.members.includes(userId)
}

async function ensureReferenceData(createdByUserId: string) {
  for (const [index, name] of defaultCategories.entries()) {
    await prisma.category.upsert({
      where: { id: `c${index + 1}` },
      update: { ownerId: null, name },
      create: { id: `c${index + 1}`, ownerId: null, name }
    })
  }

  for (const [index, name] of defaultBlockers.entries()) {
    await prisma.blocker.upsert({
      where: { name },
      update: { isDefault: true },
      create: { id: `b${index + 1}`, name, isDefault: true }
    })
  }

  for (const [index, [code, name, description]] of medalDefinitions.entries()) {
    await prisma.medal.upsert({
      where: { code },
      update: { name, description },
      create: { id: `m${index + 1}`, code, name, description }
    })
  }

  await prisma.client.upsert({
    where: { id: 'cl1' },
    update: { name: 'AirGradient' },
    create: { id: 'cl1', name: 'AirGradient', createdByUserId }
  })
  await prisma.project.upsert({
    where: { id: 'p1' },
    update: { clientId: 'cl1', name: 'Breezy Time Tracker', description: 'Internal focus and process insight.' },
    create: { id: 'p1', clientId: 'cl1', name: 'Breezy Time Tracker', description: 'Internal focus and process insight.', createdByUserId }
  })
}

async function categoryOrDefault(categoryId?: string, userId = 'u1') {
  await ensureReferenceData(userId)
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ ownerId: null }, { ownerId: userId }]
      }
    })
    if (category) return category.id
  }
  return 'c1'
}

async function validOptionalClientId(clientId?: string | null) {
  const id = compactOptionalId(clientId || undefined)
  if (!id) return null
  return (await prisma.client.findUnique({ where: { id } })) ? id : null
}

async function validOptionalProjectId(projectId?: string | null, clientId?: string | null) {
  const id = compactOptionalId(projectId || undefined)
  if (!id) return null
  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return null
  return clientId && project.clientId !== clientId ? null : id
}

async function blockerIdsForNames(names: string[]) {
  const available = await prisma.blocker.findMany()
  const availableByName = new Map(available.map((blocker) => [blocker.name, blocker.id]))
  const unknown = names.filter((name) => !availableByName.has(name))
  if (unknown.length) {
    throw createError({ statusCode: 400, statusMessage: `Unknown blocker: ${unknown[0]}` })
  }
  return names.map((name) => availableByName.get(name)).filter((id): id is string => Boolean(id))
}

async function loadVisibleTasks(userId: string) {
  return prisma.task.findMany({
    where: {
      isArchived: false,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
        { invites: { some: { recipientId: userId } } }
      ]
    },
    include: { members: true },
    orderBy: { createdAt: 'desc' }
  })
}

async function loadVisibleEntries(userId: string, visibleTaskIds: string[]) {
  return prisma.timeEntry.findMany({
    where: {
      OR: [
        { userId },
        { taskId: { in: visibleTaskIds }, task: { isShared: true } }
      ]
    },
    include: {
      pauses: true,
      feedback: true,
      blockers: { include: { blocker: true } }
    },
    orderBy: { startedAt: 'desc' }
  })
}

export async function publicState(userId = 'u1', team = 'All') {
  await ensureReferenceData(userId)
  const [user, users, activeSessions, invitations, categories, clients, projects, blockers, visibleTasks, settings] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.user.findMany({ orderBy: { displayName: 'asc' } }),
    prisma.authSession.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      distinct: ['userId'],
      include: { user: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.taskInvite.findMany({
      where: { OR: [{ senderId: userId }, { recipientId: userId }] },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.category.findMany({ orderBy: { id: 'asc' } }),
    prisma.client.findMany({ orderBy: { name: 'asc' } }),
    prisma.project.findMany({ orderBy: { name: 'asc' } }),
    prisma.blocker.findMany({ orderBy: { id: 'asc' } }),
    loadVisibleTasks(userId),
    prisma.settings.findUnique({ where: { userId } })
  ])

  const visibleTaskIds = visibleTasks.map((task) => task.id)
  const entries = await loadVisibleEntries(userId, visibleTaskIds)
  const signedInUsersById = new Map(activeSessions.map((session) => [session.user.id, mapUser(session.user)]))
  signedInUsersById.set(user.id, mapUser(user))

  return {
    user: mapUser(user),
    users: users.map(mapUser),
    signedInUsers: [...signedInUsersById.values()],
    taskInvitations: invitations.map(mapInvitation),
    categories: categories.map((category) => ({ id: category.id, ownerId: category.ownerId, name: category.name })),
    clients: clients.map((client) => ({ id: client.id, name: client.name })),
    projects: projects.map((project) => ({ id: project.id, clientId: project.clientId, name: project.name, description: project.description })),
    blockers: blockers.map((blocker) => blocker.name),
    tasks: visibleTasks.map(mapTask),
    entries: entries.map(mapEntry),
    settings: settings
      ? {
          idleThresholdMinutes: settings.idleThresholdMinutes,
          nudgeCadenceMinutes: settings.nudgeCadenceMinutes,
          breezyVerbosity: settings.breezyVerbosity,
          muted: settings.muted,
          locationEnabled: settings.locationEnabled,
          activityEnabled: settings.activityEnabled,
          locationLabels: settings.locationLabels
        }
      : defaultSettings,
    dashboards: await buildDashboards(userId, team),
    journey: await buildJourney(userId),
    medals: await buildMedals(userId)
  }
}

export async function buildDashboards(userId: string, team = 'All') {
  const [ownEntries, companyEntries, activeTrackers] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId, endedAt: { not: null } },
      include: { feedback: true, blockers: { include: { blocker: true } }, task: { include: { category: true } } },
      orderBy: { startedAt: 'desc' }
    }),
    prisma.timeEntry.findMany({
      where: {
        endedAt: { not: null },
        ...(team === 'All' ? {} : { user: { team } })
      },
      include: { feedback: true, blockers: { include: { blocker: true } }, task: { include: { category: true } }, user: true },
      orderBy: { startedAt: 'desc' }
    }),
    prisma.trackingPresence.findMany({
      where: { task: { isShared: true } },
      include: { user: true, task: true },
      orderBy: { startedAt: 'desc' }
    })
  ])

  return {
    personal: {
      totalHours: roundHours(ownEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0)),
      byCategory: rollupBy(ownEntries, (entry) => entry.task.category.name),
      byTask: rollupBy(ownEntries, (entry) => entry.task.title),
      blockers: blockerRollup(ownEntries),
      flow: countBy(ownEntries, (entry) => entry.feedback?.flowQuality || 'Skipped'),
      efficiency: countBy(ownEntries, (entry) => entry.feedback?.efficiencyFeel || 'Skipped'),
      energy: countBy(ownEntries, (entry) => entry.feedback?.energy || 'Skipped'),
      trend: weeklyTrend(ownEntries),
      estimateVariance: estimateVariance(ownEntries)
    },
    company: {
      totalHours: roundHours(companyEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0)),
      byCategory: rollupBy(companyEntries, (entry) => entry.task.category.name),
      blockers: blockerRollup(companyEntries),
      flow: countBy(companyEntries, (entry) => entry.feedback?.flowQuality || 'Skipped'),
      efficiency: countBy(companyEntries, (entry) => entry.feedback?.efficiencyFeel || 'Skipped'),
      contextSwitchTrend: weeklyTrend(companyEntries, (entry) => entry.contextSwitches),
      team
    },
    activeTrackers: activeTrackers.map((presence) => ({
      taskId: presence.taskId,
      userId: presence.userId,
      displayName: presence.user.displayName
    }))
  }
}

export async function createTask(input: TaskInput) {
  const title = String(input.title || '').trim()
  if (!title) throw createError({ statusCode: 400, statusMessage: 'Task title is required.' })

  const ownerId = input.ownerId || 'u1'
  const categoryId = await categoryOrDefault(input.categoryId, ownerId)
  const clientId = await validOptionalClientId(input.clientId)
  const projectId = await validOptionalProjectId(input.projectId, clientId)
  const inviteeIds = [...new Set((input.members || []).filter((memberId) => memberId !== ownerId))]
  const validInvitees = await prisma.user.findMany({
    where: { id: { in: inviteeIds } },
    select: { id: true }
  })
  const invitedUserIds = validInvitees.map((user) => user.id)

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title,
        description: input.description || '',
        categoryId,
        clientId,
        projectId,
        estimateMinutes: Number(input.estimateMinutes || 0) || null,
        ownerId,
        isShared: invitedUserIds.length > 0,
        members: {
          create: {
            userId: ownerId,
            role: 'owner',
            invitedByUserId: ownerId
          }
        }
      },
      include: { members: true }
    })

    for (const recipientId of invitedUserIds) {
      await tx.taskInvite.create({
        data: {
          taskId: task.id,
          senderId: ownerId,
          recipientId,
          status: 'pending'
        }
      })
    }

    return mapTask(task)
  })
}

export async function shareTask(input: { taskId: string, senderId: string, recipientIds: string[] }) {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    include: { members: true }
  })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found.' })
  if (task.ownerId !== input.senderId) throw createError({ statusCode: 403, statusMessage: 'Only the task owner can share this task.' })

  const existingMemberIds = new Set(task.members.map((member) => member.userId))
  const validRecipients = await prisma.user.findMany({
    where: {
      id: {
        in: [...new Set(input.recipientIds)]
          .filter((userId) => userId !== input.senderId)
          .filter((userId) => !existingMemberIds.has(userId))
      }
    },
    select: { id: true }
  })

  await prisma.$transaction(async (tx) => {
    for (const recipient of validRecipients) {
      const existing = await tx.taskInvite.findFirst({
        where: {
          taskId: task.id,
          recipientId: recipient.id,
          status: 'pending'
        }
      })
      if (existing) continue
      await tx.taskInvite.create({
        data: {
          taskId: task.id,
          senderId: input.senderId,
          recipientId: recipient.id,
          status: 'pending'
        }
      })
    }

    if (validRecipients.length) {
      await tx.task.update({
        where: { id: task.id },
        data: { isShared: true }
      })
    }
  })

  return prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: { members: true } }).then(mapTask)
}

export async function acceptTaskInvitation(input: { invitationId: string, userId: string }) {
  const invitation = await prisma.taskInvite.findFirst({
    where: {
      id: input.invitationId,
      recipientId: input.userId
    },
    include: { task: { include: { members: true } } }
  })
  if (!invitation) throw createError({ statusCode: 404, statusMessage: 'Invitation not found.' })

  await prisma.$transaction(async (tx) => {
    await tx.taskInvite.update({
      where: { id: invitation.id },
      data: { status: 'accepted', respondedAt: new Date() }
    })
    await tx.task.update({
      where: { id: invitation.taskId },
      data: { isShared: true }
    })
    await tx.taskMember.upsert({
      where: { taskId_userId: { taskId: invitation.taskId, userId: input.userId } },
      update: { role: 'member', invitedByUserId: invitation.senderId },
      create: {
        taskId: invitation.taskId,
        userId: input.userId,
        role: 'member',
        invitedByUserId: invitation.senderId
      }
    })
  })

  return prisma.task.findUniqueOrThrow({ where: { id: invitation.taskId }, include: { members: true } }).then(mapTask)
}

export async function startEntry(input: { taskId: string, userId: string }) {
  const task = await prisma.task.findUnique({
    where: { id: input.taskId },
    include: { members: true }
  })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found.' })
  if (!canTrackTask(mapTask(task), input.userId)) {
    throw createError({ statusCode: 403, statusMessage: 'Accept the task invitation before tracking this task.' })
  }

  const active = await prisma.timeEntry.findFirst({ where: { userId: input.userId, endedAt: null } })
  if (active) throw createError({ statusCode: 409, statusMessage: 'Stop the current timer first.' })

  const startedAt = new Date()
  return prisma.$transaction(async (tx) => {
    const entry = await tx.timeEntry.create({
      data: {
        taskId: input.taskId,
        userId: input.userId,
        startedAt,
        durationSeconds: 0,
        isManual: false,
        idleSeconds: 0,
        contextSwitches: 0,
        locationLabel: 'Home office'
      },
      include: { pauses: true, feedback: true, blockers: { include: { blocker: true } } }
    })
    await tx.trackingPresence.upsert({
      where: { userId: input.userId },
      update: { taskId: input.taskId, entryId: entry.id, startedAt },
      create: { userId: input.userId, taskId: input.taskId, entryId: entry.id, startedAt }
    })
    return mapEntry(entry)
  })
}

export async function stopEntry(input: {
  entryId: string
  userId: string
  idleSeconds: number
  contextSwitches: number
  pauses: PauseWindow[]
  feedback?: EntryFeedbackInput
  blockers: string[]
}) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: input.entryId, userId: input.userId, endedAt: null }
  })
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Entry not found.' })

  const endedAt = new Date()
  const pauses = sanitizePauses(input.pauses || [])
  const feedback = validateFeedback(input.feedback)
  const blockers = normalizeBlockers(input.blockers)
  const blockerIds = await blockerIdsForNames(blockers)
  const durationSeconds = calculateDuration(entry.startedAt.toISOString(), endedAt.toISOString(), pauses, Math.max(0, Number(input.idleSeconds || 0)))

  const saved = await prisma.$transaction(async (tx) => {
    await tx.entryPause.deleteMany({ where: { entryId: entry.id } })
    await tx.entryFeedback.deleteMany({ where: { entryId: entry.id } })
    await tx.entryBlocker.deleteMany({ where: { entryId: entry.id } })

    const updated = await tx.timeEntry.update({
      where: { id: entry.id },
      data: {
        endedAt,
        durationSeconds,
        idleSeconds: Math.max(0, Number(input.idleSeconds || 0)),
        contextSwitches: Math.max(0, Number(input.contextSwitches || 0)),
        pauses: {
          create: pauses.map((pause) => ({
            startedAt: new Date(pause.startedAt),
            endedAt: new Date(pause.endedAt),
            durationSeconds: calculateDuration(pause.startedAt, pause.endedAt)
          }))
        },
        feedback: feedback ? { create: feedback } : undefined,
        blockers: {
          create: blockerIds.map((blockerId) => ({ blockerId }))
        }
      },
      include: { pauses: true, feedback: true, blockers: { include: { blocker: true } } }
    })

    await tx.trackingPresence.deleteMany({ where: { userId: input.userId } })
    return updated
  })

  await refreshDerivedRecords(input.userId)
  return mapEntry(saved)
}

export async function createManualEntry(input: TimeEntryInput) {
  const userId = input.userId || 'u1'
  const startedAt = normaliseDateInput(input.startedAt)
  const endedAt = normaliseDateInput(input.endedAt)
  if (!startedAt || !endedAt || endedAt <= startedAt) {
    throw createError({ statusCode: 400, statusMessage: 'Manual entries need start and end times where end is after start.' })
  }

  const task = await taskForManualEntry(userId, input.taskId)
  if (!canTrackTask(mapTask(task), userId)) {
    throw createError({ statusCode: 403, statusMessage: 'Accept the task invitation before tracking this task.' })
  }

  const overlap = await prisma.timeEntry.findFirst({
    where: {
      userId,
      OR: [
        { endedAt: null },
        { startedAt: { lt: endedAt }, endedAt: { gt: startedAt } }
      ]
    }
  })
  if (overlap) throw createError({ statusCode: 409, statusMessage: 'Manual entry overlaps existing tracked time.' })

  const feedback = validateFeedback(input.feedback)
  const blockers = normalizeBlockers(input.blockers?.length ? input.blockers : ['None'])
  const blockerIds = await blockerIdsForNames(blockers)
  const durationSeconds = calculateDuration(startedAt.toISOString(), endedAt.toISOString(), [], Math.max(0, Number(input.idleSeconds || 0)))

  const entry = await prisma.timeEntry.create({
    data: {
      taskId: task.id,
      userId,
      startedAt,
      endedAt,
      durationSeconds,
      isManual: true,
      idleSeconds: Math.max(0, Number(input.idleSeconds || 0)),
      contextSwitches: Math.max(0, Number(input.contextSwitches || 0)),
      locationLabel: input.locationLabel || 'Manual',
      feedback: feedback ? { create: feedback } : undefined,
      blockers: { create: blockerIds.map((blockerId) => ({ blockerId })) },
      auditEvents: {
        create: {
          userId,
          eventType: 'manual_created',
          changes: {
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            taskId: task.id
          }
        }
      }
    },
    include: { pauses: true, feedback: true, blockers: { include: { blocker: true } } }
  })

  await refreshDerivedRecords(userId)
  return mapEntry(entry)
}

export async function updateProfile(userId: string, input: { displayName?: string, team?: string }) {
  const displayName = String(input.displayName || '').trim()
  const team = String(input.team || '').trim()
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(displayName ? { displayName } : {}),
      ...(team ? { team } : {})
    }
  })
}

export async function updateSettings(userId: string, settings: Record<string, unknown>) {
  await prisma.settings.upsert({
    where: { userId },
    update: coerceSettings(settings),
    create: { userId, ...defaultSettings, ...coerceSettings(settings) }
  })
}

export async function exportRows(userId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { userId, endedAt: { not: null } },
    include: {
      feedback: true,
      blockers: { include: { blocker: true } },
      task: { include: { category: true, client: true, project: true } }
    },
    orderBy: { startedAt: 'desc' }
  })

  return entries.map((entry) => ({
    entry_id: entry.id,
    task: entry.task.title,
    tags: entry.task.category.name,
    category: entry.task.category.name,
    client: entry.task.client?.name || '',
    project: entry.task.project?.name || '',
    started_at: entry.startedAt.toISOString(),
    ended_at: entry.endedAt?.toISOString() || '',
    duration_seconds: entry.durationSeconds,
    idle_seconds: entry.idleSeconds,
    context_switches: entry.contextSwitches,
    location_label: entry.locationLabel || '',
    manual: entry.isManual,
    edited: entry.isEdited,
    flow_quality: entry.feedback?.flowQuality || '',
    efficiency_feel: entry.feedback?.efficiencyFeel || '',
    energy: entry.feedback?.energy || '',
    note: entry.feedback?.note || '',
    blockers: entry.blockers.map((row) => row.blocker.name).join('|')
  }))
}

export async function exportData(userId: string, format: 'csv' | 'json') {
  const rows = await exportRows(userId)
  await prisma.export.create({
    data: { userId, format }
  })
  return format === 'csv' ? toCsv(rows) : JSON.stringify(rows, null, 2)
}

function sanitizePauses(pauses: PauseWindow[]) {
  return pauses
    .map((pause) => ({ startedAt: String(pause.startedAt || ''), endedAt: String(pause.endedAt || '') }))
    .filter((pause) => {
      const startedAt = new Date(pause.startedAt)
      const endedAt = new Date(pause.endedAt)
      return !Number.isNaN(startedAt.getTime()) && !Number.isNaN(endedAt.getTime()) && endedAt > startedAt
    })
}

function coerceSettings(settings: Record<string, unknown>) {
  return {
    idleThresholdMinutes: Number(settings.idleThresholdMinutes || defaultSettings.idleThresholdMinutes),
    nudgeCadenceMinutes: Number(settings.nudgeCadenceMinutes || defaultSettings.nudgeCadenceMinutes),
    breezyVerbosity: String(settings.breezyVerbosity || defaultSettings.breezyVerbosity),
    muted: Boolean(settings.muted),
    locationEnabled: Boolean(settings.locationEnabled),
    activityEnabled: settings.activityEnabled === undefined ? defaultSettings.activityEnabled : Boolean(settings.activityEnabled),
    locationLabels: Array.isArray(settings.locationLabels) ? settings.locationLabels : defaultSettings.locationLabels
  }
}

function rollupBy<T extends { durationSeconds: number }>(entries: T[], label: (entry: T) => string) {
  const map = new Map<string, number>()
  for (const entry of entries) map.set(label(entry), (map.get(label(entry)) || 0) + entry.durationSeconds)
  return [...map.entries()].map(([name, seconds]) => ({ name, hours: roundHours(seconds), seconds })).sort((a, b) => b.seconds - a.seconds)
}

function countBy<T>(entries: T[], label: (entry: T) => string) {
  const map = new Map<string, number>()
  for (const entry of entries) map.set(label(entry), (map.get(label(entry)) || 0) + 1)
  return [...map.entries()].map(([name, count]) => ({ name, count }))
}

function blockerRollup(entries: Array<{ durationSeconds: number, blockers: { blocker: { name: string } }[] }>) {
  const map = new Map<string, { count: number, seconds: number }>()
  for (const entry of entries) {
    for (const blocker of entry.blockers.map((item) => item.blocker.name).filter((item) => item !== 'None')) {
      const current = map.get(blocker) || { count: 0, seconds: 0 }
      current.count += 1
      current.seconds += entry.durationSeconds
      map.set(blocker, current)
    }
  }
  return [...map.entries()].map(([name, value]) => ({ name, count: value.count, hours: roundHours(value.seconds) })).sort((a, b) => b.hours - a.hours)
}

function weeklyTrend<T extends { startedAt: Date, durationSeconds: number }>(entries: T[], value: (entry: T) => number = (entry) => entry.durationSeconds / 3600) {
  const formatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const map = new Map<string, number>()
  for (const entry of entries) {
    const date = new Date(entry.startedAt)
    const day = date.getUTCDay()
    date.setUTCDate(date.getUTCDate() - day)
    const label = formatter.format(date)
    map.set(label, Math.round(((map.get(label) || 0) + value(entry)) * 10) / 10)
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).slice(-8)
}

function estimateVariance(entries: Array<{ durationSeconds: number, task: { title: string, estimateMinutes: number | null } }>) {
  return entries.map((entry) => ({
    task: entry.task.title,
    estimateMinutes: entry.task.estimateMinutes || 0,
    actualMinutes: Math.round(entry.durationSeconds / 60),
    varianceMinutes: entry.task.estimateMinutes ? Math.round(entry.durationSeconds / 60 - entry.task.estimateMinutes) : 0
  })).slice(0, 5)
}

async function taskForManualEntry(userId: string, taskId?: string) {
  if (taskId) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { members: true } })
    if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found.' })
    return task
  }

  const task = await prisma.task.findFirst({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: { members: true },
    orderBy: { createdAt: 'desc' }
  })
  if (!task) throw createError({ statusCode: 400, statusMessage: 'Create a task before adding manual time.' })
  return task
}

async function buildJourney(userId: string) {
  const [days, entries] = await Promise.all([
    prisma.breezyDay.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.timeEntry.findMany({
      where: { userId, endedAt: { not: null } },
      include: { feedback: true, blockers: { include: { blocker: true } } },
      orderBy: { startedAt: 'asc' }
    })
  ])
  const hoursByDate = new Map<string, number>()
  for (const entry of entries) {
    const key = displayDate(entry.startedAt)
    hoursByDate.set(key, (hoursByDate.get(key) || 0) + entry.durationSeconds)
  }

  const dayRows = days.length ? days.map((day) => ({
    date: displayDate(day.date),
    mood: day.breezyMood,
    airClarityScore: day.airClarityScore,
    hours: roundHours(hoursByDate.get(displayDate(day.date)) || 0)
  })) : deriveJourneyFromEntries(entries)

  const formatter = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' })
  return dayRows.map((row, index) => ({
    ...row,
    weekLabel: `${formatter.format(new Date(row.date))} week ${Math.floor(index % 4) + 1}`
  }))
}

function deriveJourneyFromEntries(entries: Array<{
  startedAt: Date
  durationSeconds: number
  idleSeconds: number
  contextSwitches: number
  feedback: { flowQuality: string, efficiencyFeel: string, energy: string } | null
  blockers: { blocker: { name: string } }[]
}>) {
  const byDate = new Map<string, typeof entries>()
  for (const entry of entries) {
    const key = displayDate(entry.startedAt)
    byDate.set(key, [...(byDate.get(key) || []), entry])
  }
  return [...byDate.entries()].map(([date, dayEntries]) => {
    const derived = deriveBreezyDay(dayEntries.map((entry) => ({
      durationSeconds: entry.durationSeconds,
      flowQuality: entry.feedback?.flowQuality as FlowQuality | undefined,
      efficiencyFeel: entry.feedback?.efficiencyFeel as EfficiencyFeel | undefined,
      energy: entry.feedback?.energy as EnergyLevel | undefined,
      blockers: entry.blockers.map((row) => row.blocker.name),
      idleSeconds: entry.idleSeconds,
      contextSwitches: entry.contextSwitches
    })))
    return {
      date,
      ...derived,
      hours: roundHours(dayEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0))
    }
  }).sort((a, b) => a.date.localeCompare(b.date))
}

async function buildMedals(userId: string) {
  await ensureReferenceData(userId)
  const [medals, awarded] = await Promise.all([
    prisma.medal.findMany({ orderBy: { id: 'asc' } }),
    prisma.userMedal.findMany({ where: { userId }, include: { medal: true } })
  ])
  const awardedCodes = new Set(awarded.map((row) => row.medal.code))
  return medals.map((medal) => ({
    code: medal.code,
    name: medal.name,
    description: medal.description,
    awarded: awardedCodes.has(medal.code)
  }))
}

async function refreshDerivedRecords(userId: string) {
  const entries = await prisma.timeEntry.findMany({
    where: { userId, endedAt: { not: null } },
    include: { feedback: true, blockers: { include: { blocker: true } } }
  })
  const byDate = new Map<string, typeof entries>()
  for (const entry of entries) {
    const key = displayDate(entry.startedAt)
    byDate.set(key, [...(byDate.get(key) || []), entry])
  }

  for (const [date, dayEntries] of byDate.entries()) {
    const derived = deriveBreezyDay(dayEntries.map((entry) => ({
      durationSeconds: entry.durationSeconds,
      flowQuality: entry.feedback?.flowQuality as FlowQuality | undefined,
      efficiencyFeel: entry.feedback?.efficiencyFeel as EfficiencyFeel | undefined,
      energy: entry.feedback?.energy as EnergyLevel | undefined,
      blockers: entry.blockers.map((row) => row.blocker.name),
      idleSeconds: entry.idleSeconds,
      contextSwitches: entry.contextSwitches
    })))
    await prisma.breezyDay.upsert({
      where: { userId_date: { userId, date: new Date(`${date}T00:00:00.000Z`) } },
      update: { breezyMood: derived.mood, airClarityScore: derived.airClarityScore },
      create: { userId, date: new Date(`${date}T00:00:00.000Z`), breezyMood: derived.mood, airClarityScore: derived.airClarityScore }
    })
  }

  const awardedCodes = awardMedals(entries.map((entry) => ({
    durationSeconds: entry.durationSeconds,
    flowQuality: entry.feedback?.flowQuality as FlowQuality | undefined,
    efficiencyFeel: entry.feedback?.efficiencyFeel as EfficiencyFeel | undefined,
    energy: entry.feedback?.energy as EnergyLevel | undefined,
    blockers: entry.blockers.map((row) => row.blocker.name),
    idleSeconds: entry.idleSeconds,
    contextSwitches: entry.contextSwitches
  })))
  const medals = await prisma.medal.findMany({ where: { code: { in: awardedCodes } } })
  await prisma.$transaction([
    prisma.userMedal.deleteMany({ where: { userId } }),
    prisma.userMedal.createMany({
      data: medals.map((medal) => ({ userId, medalId: medal.id })),
      skipDuplicates: true
    })
  ])
}
