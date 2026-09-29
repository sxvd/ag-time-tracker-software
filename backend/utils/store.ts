import { calculateDuration, deriveBreezyDay, toCsv } from '../../shared/utils/time'
import type { ClosedPauseWindow, EfficiencyFeel, EnergyLevel, FlowQuality } from '../../shared/utils/time'
import type { AccountSettingsInput } from '../../shared/types/account-settings'
import { SYSTEM_BREEZY_SETTINGS } from '../../shared/constants/account-settings.mjs'
import { DEFAULT_CATEGORY_NAMES } from '../../shared/constants/categories.mjs'
import { Prisma } from '@prisma/client'
import { enqueueDerivedRefresh, processDerivedRefresh } from './derived-refresh'
import { mapBreezyNudge } from './breezy-nudges'
import { prisma } from './prisma'
import { optionalString, pauseWindows } from './validation'
import { lockActiveEntry } from './timer-lock'

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
  ownerId?: string
  members?: string[]
  requireInvitees?: boolean
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
  pauses?: ClosedPauseWindow[]
}

export interface StartEntryInput {
  taskId: string
  userId: string
  locationLabel?: string
}

export interface EntryFeedbackInput {
  flowQuality: FlowQuality
  efficiencyFeel: EfficiencyFeel
  energy: EnergyLevel
  note: string
}

const defaultBlockers = ['Waiting on someone', 'Tool was slow or broke', 'Unclear requirements', 'Interruptions', 'Context switching', 'Meetings overran', 'None']
const flowValues = ['Great flow', 'Neutral', 'Friction']
const efficiencyValues = ['Felt efficient', 'Felt manual', 'Felt wasteful']
const energyValues = ['High', 'OK', 'Drained']

const defaultSettings = {
  idleThresholdMinutes: 5,
  ...SYSTEM_BREEZY_SETTINGS,
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

async function resolveNewLocationLabel(userId: string, requested?: string) {
  const requestedLocation = String(requested || '').trim()
  if (!requestedLocation) return null
  const settings = await prisma.settings.findUnique({ where: { userId } })
  if (!settings?.locationEnabled) return null
  const allowedLabels = Array.isArray(settings.locationLabels)
    ? settings.locationLabels.filter((label): label is string => typeof label === 'string')
    : []
  if (!allowedLabels.includes(requestedLocation)) {
    throw createError({ statusCode: 400, statusMessage: 'Select one of your saved location labels.' })
  }
  return requestedLocation
}

function mapUser(user: { id: string, email: string, displayName: string, team: string }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    team: user.team
  }
}

function mapCollaborator(user: { id: string, displayName: string, team: string }) {
  return {
    id: user.id,
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
  excludedIdleSeconds: number
  contextSwitches: number
  locationLabel: string | null
  createdAt: Date
  pauses: { startedAt: Date, endedAt: Date | null, durationSeconds: number | null }[]
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
    excludedIdleSeconds: entry.excludedIdleSeconds,
    contextSwitches: entry.contextSwitches,
    locationLabel: entry.locationLabel || '',
    pauses: entry.pauses.map((pause) => ({
      startedAt: pause.startedAt.toISOString(),
      endedAt: pause.endedAt?.toISOString() || null,
      durationSeconds: pause.durationSeconds
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
    note: optionalString('feedback.note', feedback.note, { max: 2_000 }) || ''
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
  for (const [index, name] of DEFAULT_CATEGORY_NAMES.entries()) {
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

async function loadOwnedEntries(userId: string) {
  return prisma.timeEntry.findMany({
    where: { userId },
    include: {
      pauses: true,
      feedback: true,
      blockers: { include: { blocker: true } }
    },
    orderBy: { startedAt: 'desc' }
  })
}

async function loadSharedTaskEffort(userId: string) {
  const tasks = await prisma.task.findMany({
    where: {
      isShared: true,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } }
      ]
    },
    select: {
      id: true,
      title: true,
      members: {
        select: {
          role: true,
          userId: true,
          user: { select: { displayName: true } }
        }
      },
      entries: {
        where: { userId, endedAt: { not: null } },
        select: {
          durationSeconds: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return tasks.map((task) => ({
    taskId: task.id,
    taskTitle: task.title,
    myDurationSeconds: task.entries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
    members: task.members
      .map((member) => ({
        userId: member.userId,
        displayName: member.user.displayName,
        role: member.role as 'owner' | 'member'
      }))
      .sort((left, right) => {
        if (left.role !== right.role) return left.role === 'owner' ? -1 : 1
        return left.displayName.localeCompare(right.displayName)
      })
  }))
}

export async function publicState(userId = 'u1') {
  await ensureReferenceData(userId)
  const [user, users, activeSessions, invitations, categories, clients, projects, blockers, visibleTasks, settings, breezyNudges] = await Promise.all([
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
    prisma.settings.findUnique({ where: { userId } }),
    loadRecentBreezyNudges(userId)
  ])

  const [entries, sharedTaskEffort] = await Promise.all([
    loadOwnedEntries(userId),
    loadSharedTaskEffort(userId)
  ])
  const signedInUsersById = new Map(activeSessions.map((session) => [session.user.id, mapCollaborator(session.user)]))
  signedInUsersById.set(user.id, mapCollaborator(user))

  return {
    user: mapUser(user),
    users: users.map(mapCollaborator),
    signedInUsers: [...signedInUsersById.values()],
    taskInvitations: invitations.map(mapInvitation),
    categories: categories.map((category) => ({ id: category.id, ownerId: category.ownerId, name: category.name })),
    clients: clients.map((client) => ({ id: client.id, name: client.name })),
    projects: projects.map((project) => ({ id: project.id, clientId: project.clientId, name: project.name, description: project.description })),
    blockers: blockers.map((blocker) => blocker.name),
    tasks: visibleTasks.map(mapTask),
    entries: entries.map(mapEntry),
    sharedTaskEffort,
    breezyNudges: breezyNudges.map(mapBreezyNudge),
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
    dashboards: await buildDashboards(userId),
    journey: await buildJourney(userId),
    medals: await buildMedals(userId)
  }
}

async function loadRecentBreezyNudges(userId: string) {
  return prisma.$queryRaw<Array<{
    id: string
    relatedEntryId: string
    type: string
    message: string
    shownAt: Date
    acknowledgedAt: Date | null
  }>>(Prisma.sql`
    SELECT
      id,
      related_entry_id AS "relatedEntryId",
      type,
      message,
      shown_at AS "shownAt",
      acknowledged_at AS "acknowledgedAt"
    FROM breezy_nudges
    WHERE user_id = ${userId}
      AND related_entry_id IS NOT NULL
    ORDER BY (acknowledged_at IS NULL) DESC, shown_at DESC
    LIMIT 20
  `)
}

export async function buildDashboards(userId: string) {
  const [ownEntries] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId, endedAt: { not: null } },
      include: { feedback: true, blockers: { include: { blocker: true } }, task: { include: { category: true } } },
      orderBy: { startedAt: 'desc' }
    })
  ])

  const ownTotalSeconds = ownEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0)

  return {
    personal: {
      totalHours: roundHours(ownTotalSeconds),
      totalSeconds: ownTotalSeconds,
      byCategory: rollupBy(ownEntries, (entry) => entry.task.category.name),
      byTask: rollupBy(ownEntries, (entry) => entry.task.title),
      blockers: blockerRollup(ownEntries),
      flow: countBy(ownEntries, (entry) => entry.feedback?.flowQuality || 'Skipped'),
      efficiency: countBy(ownEntries, (entry) => entry.feedback?.efficiencyFeel || 'Skipped'),
      energy: countBy(ownEntries, (entry) => entry.feedback?.energy || 'Skipped'),
      trend: weeklyTrend(ownEntries),
      weeks: buildPersonalWeeks(ownEntries)
    }
  }
}

export const companyDashboardMetrics = ['trackedTime', 'sessions', 'contextSwitches'] as const
export const companyDashboardGroupings = ['category', 'flow', 'efficiency'] as const
export type CompanyDashboardMetric = typeof companyDashboardMetrics[number]
export type CompanyDashboardGrouping = typeof companyDashboardGroupings[number]

export interface CompanyDashboardInput {
  categoryId?: string
  weekStart?: Date
  metric: CompanyDashboardMetric
  groupBy: CompanyDashboardGrouping
}

type CompanyDashboardEntry = PersonalWeekEntry & { contextSwitches: number }

export async function buildCompanyDashboard(input: CompanyDashboardInput) {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true }
  })
  const categoryId = input.categoryId || null
  if (categoryId && !categories.some(category => category.id === categoryId)) {
    throw createError({ statusCode: 400, statusMessage: 'Select an available category.' })
  }

  const scope = categoryId ? { task: { categoryId } } : {}
  const latest = input.weekStart
    ? null
    : await prisma.timeEntry.findFirst({
        where: { endedAt: { not: null }, ...scope },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true }
      })
  const currentWeekStart = startOfUtcWeek(new Date())
  const requestedStart = input.weekStart || startOfUtcWeek(latest?.startedAt || new Date())
  const start = requestedStart > currentWeekStart ? currentWeekStart : requestedStart
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  const visibleEnd = new Date(start)
  visibleEnd.setUTCDate(visibleEnd.getUTCDate() + 6)

  const [entries, activeSharedSessionCount] = await Promise.all([
    prisma.timeEntry.findMany({
      where: {
        endedAt: { not: null },
        startedAt: { gte: start, lt: end },
        ...scope
      },
      include: {
        feedback: true,
        blockers: { include: { blocker: true } },
        task: { include: { category: true } }
      },
      orderBy: { startedAt: 'asc' }
    }),
    prisma.trackingPresence.count({
      where: {
        task: { isShared: true, ...(categoryId ? { categoryId } : {}) }
      }
    })
  ])
  const companyEntries = entries as CompanyDashboardEntry[]

  return {
    categoryId,
    availableCategories: categories,
    week: {
      start: displayDate(start),
      end: displayDate(visibleEnd),
      label: personalWeekLabel(start, visibleEnd)
    },
    totalSeconds: companyEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
    activeSharedSessionCount,
    overview: {
      metric: input.metric,
      groupBy: input.groupBy,
      days: buildCompanyOverviewDays(companyEntries, start, input.metric, input.groupBy)
    },
    blockers: blockerRollup(companyEntries, 5),
    flow: recordedCountBy(companyEntries, entry => entry.feedback?.flowQuality),
    efficiency: recordedCountBy(companyEntries, entry => entry.feedback?.efficiencyFeel)
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
  if (input.requireInvitees && invitedUserIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Choose at least one existing teammate.' })
  }

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title,
        description: input.description || '',
        categoryId,
        clientId,
        projectId,
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
      recipientId: input.userId,
      status: 'pending'
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

export async function startEntry(input: StartEntryInput) {
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

  const locationLabel = await resolveNewLocationLabel(input.userId, input.locationLabel)

  const startedAt = new Date()
  try {
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.timeEntry.create({
        data: {
          taskId: input.taskId,
          userId: input.userId,
          startedAt,
          durationSeconds: 0,
          isManual: false,
          idleSeconds: 0,
          excludedIdleSeconds: 0,
          contextSwitches: 0,
          locationLabel
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Stop the current timer first.' })
    }
    throw error
  }
}

export async function stopEntry(input: {
  entryId: string
  userId: string
  feedback?: EntryFeedbackInput
  blockers: string[]
}) {
  const feedback = validateFeedback(input.feedback)
  const blockers = normalizeBlockers(input.blockers)
  const blockerIds = await blockerIdsForNames(blockers)

  const saved = await prisma.$transaction(async (tx) => {
    await lockActiveEntry(tx, input.userId, input.entryId)
    const entry = await tx.timeEntry.findUniqueOrThrow({
      where: { id: input.entryId },
      include: { pauses: true }
    })
    const endedAt = new Date()
    const openPause = entry.pauses.find((pause) => pause.endedAt === null)
    const pauses = entry.pauses.map((pause) => ({
      startedAt: pause.startedAt.toISOString(),
      endedAt: (pause.endedAt || endedAt).toISOString()
    }))
    const durationSeconds = calculateDuration(
      entry.startedAt.toISOString(),
      endedAt.toISOString(),
      pauses,
      entry.excludedIdleSeconds
    )

    if (openPause) {
      await tx.entryPause.update({
        where: { id: openPause.id },
        data: {
          endedAt,
          durationSeconds: calculateDuration(openPause.startedAt.toISOString(), endedAt.toISOString())
        }
      })
    }
    await tx.entryFeedback.deleteMany({ where: { entryId: input.entryId } })
    await tx.entryBlocker.deleteMany({ where: { entryId: input.entryId } })

    const updated = await tx.timeEntry.update({
      where: { id: input.entryId },
      data: {
        endedAt,
        durationSeconds,
        feedback: feedback ? { create: feedback } : undefined,
        blockers: {
          create: blockerIds.map((blockerId) => ({ blockerId }))
        }
      },
      include: { pauses: true, feedback: true, blockers: { include: { blocker: true } } }
    })

    await tx.trackingPresence.deleteMany({ where: { userId: input.userId } })
    await enqueueDerivedRefresh(tx, input.userId)
    return updated
  })

  await processDerivedRefresh(input.userId)
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
  const idleSeconds = Math.max(0, Number(input.idleSeconds || 0))
  const durationSeconds = calculateDuration(startedAt.toISOString(), endedAt.toISOString(), [], idleSeconds)
  const locationLabel = await resolveNewLocationLabel(userId, input.locationLabel)

  const entry = await prisma.$transaction(async (tx) => {
    const saved = await tx.timeEntry.create({
      data: {
        taskId: task.id,
        userId,
        startedAt,
        endedAt,
        durationSeconds,
        isManual: true,
        idleSeconds,
        excludedIdleSeconds: idleSeconds,
        contextSwitches: Math.max(0, Number(input.contextSwitches || 0)),
        locationLabel,
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
    await enqueueDerivedRefresh(tx, userId)
    return saved
  })

  await processDerivedRefresh(userId)
  return mapEntry(entry)
}

export async function updateEntry(userId: string, entryId: string, input: TimeEntryInput) {
  const existing = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId, endedAt: { not: null } },
    include: { pauses: true, idleDecisions: true, feedback: true, blockers: { include: { blocker: true } } }
  })
  if (!existing || !existing.endedAt) throw createError({ statusCode: 404, statusMessage: 'Entry not found.' })

  const taskId = input.taskId || existing.taskId
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { members: true } })
  if (!task) throw createError({ statusCode: 404, statusMessage: 'Task not found.' })
  if (!canTrackTask(mapTask(task), userId)) throw createError({ statusCode: 403, statusMessage: 'You cannot move this entry to that task.' })

  const startedAt = normaliseDateInput(input.startedAt) || existing.startedAt
  const endedAt = normaliseDateInput(input.endedAt) || existing.endedAt
  if (endedAt <= startedAt) throw createError({ statusCode: 400, statusMessage: 'Entry end must be after start.' })

  const overlap = await prisma.timeEntry.findFirst({
    where: {
      userId,
      id: { not: entryId },
      OR: [
        { endedAt: null },
        { startedAt: { lt: endedAt }, endedAt: { gt: startedAt } }
      ]
    }
  })
  if (overlap) throw createError({ statusCode: 409, statusMessage: 'Edited entry overlaps existing tracked time.' })

  const idleSeconds = existing.idleSeconds
  const excludedIdleSeconds = existing.excludedIdleSeconds
  const contextSwitches = existing.contextSwitches
  if (existing.pauses.some((pause) => pause.endedAt === null)) {
    throw createError({ statusCode: 409, statusMessage: 'Completed entry has an open pause.' })
  }
  const editablePauses = pauseWindows('pauses', input.pauses || existing.pauses.map((pause) => ({
    startedAt: pause.startedAt.toISOString(),
    endedAt: pause.endedAt!.toISOString()
  })), startedAt, endedAt)
  if (existing.idleDecisions.some((decision) => decision.startedAt < startedAt || decision.endedAt > endedAt)) {
    throw createError({ statusCode: 400, statusMessage: 'Edited time must keep saved idle decisions inside the entry.' })
  }
  const breakPauses = existing.idleDecisions
    .filter((decision) => decision.decision === 'break')
    .map((decision) => ({
      startedAt: decision.startedAt.toISOString(),
      endedAt: decision.endedAt.toISOString()
    }))
  const isSavedBreak = (pause: ClosedPauseWindow) => breakPauses.some((saved) => (
    saved.startedAt === pause.startedAt && saved.endedAt === pause.endedAt
  ))
  const overlapsSavedIdle = (pause: ClosedPauseWindow) => existing.idleDecisions.some((decision) => (
    new Date(pause.startedAt) < decision.endedAt && new Date(pause.endedAt) > decision.startedAt
  ))
  if (editablePauses.some((pause) => !isSavedBreak(pause) && overlapsSavedIdle(pause))) {
    throw createError({ statusCode: 400, statusMessage: 'Editable pauses cannot overlap saved idle decisions.' })
  }
  const pauses = pauseWindows('pauses', [
    ...editablePauses.filter((pause) => !isSavedBreak(pause)),
    ...breakPauses
  ], startedAt, endedAt)
  const feedback = validateFeedback(input.feedback || (existing.feedback ? {
    flowQuality: existing.feedback.flowQuality as FlowQuality,
    efficiencyFeel: existing.feedback.efficiencyFeel as EfficiencyFeel,
    energy: existing.feedback.energy as EnergyLevel,
    note: existing.feedback.note || ''
  } : undefined))
  const blockers = normalizeBlockers(input.blockers || existing.blockers.map((row) => row.blocker.name))
  const blockerIds = await blockerIdsForNames(blockers)
  let locationLabel = existing.locationLabel
  if (input.locationLabel !== undefined) {
    const requestedLocation = String(input.locationLabel || '').trim()
    if (!requestedLocation) {
      locationLabel = null
    } else if (requestedLocation !== existing.locationLabel) {
      locationLabel = await resolveNewLocationLabel(userId, requestedLocation)
      if (!locationLabel) {
        throw createError({ statusCode: 400, statusMessage: 'Enable location tracking before changing the location label.' })
      }
    }
  }
  const durationSeconds = calculateDuration(
    startedAt.toISOString(),
    endedAt.toISOString(),
    pauses,
    excludedIdleSeconds
  )
  const before = auditEntrySnapshot(existing)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.entryPause.deleteMany({ where: { entryId } })
    await tx.entryFeedback.deleteMany({ where: { entryId } })
    await tx.entryBlocker.deleteMany({ where: { entryId } })

    const saved = await tx.timeEntry.update({
      where: { id: entryId },
      data: {
        taskId,
        startedAt,
        endedAt,
        durationSeconds,
        idleSeconds,
        excludedIdleSeconds,
        contextSwitches,
        locationLabel,
        isEdited: true,
        pauses: {
          create: pauses.map((pause) => ({
            startedAt: new Date(pause.startedAt),
            endedAt: new Date(pause.endedAt),
            durationSeconds: calculateDuration(pause.startedAt, pause.endedAt)
          }))
        },
        feedback: feedback ? { create: feedback } : undefined,
        blockers: { create: blockerIds.map((blockerId) => ({ blockerId })) }
      },
      include: { pauses: true, feedback: true, blockers: { include: { blocker: true } } }
    })

    await tx.entryAuditEvent.create({
      data: {
        entryId,
        userId,
        eventType: 'entry_edited',
        changes: { before, after: auditEntrySnapshot(saved) }
      }
    })
    await enqueueDerivedRefresh(tx, userId)
    return saved
  })

  await processDerivedRefresh(userId)
  return mapEntry(updated)
}

function auditEntrySnapshot(entry: {
  taskId: string
  startedAt: Date
  endedAt: Date | null
  durationSeconds: number
  idleSeconds: number
  excludedIdleSeconds: number
  contextSwitches: number
  locationLabel: string | null
  pauses: Array<{ startedAt: Date, endedAt: Date | null }>
  feedback: { flowQuality: string, efficiencyFeel: string, energy: string, note: string | null } | null
  blockers: Array<{ blocker: { name: string } }>
}) {
  return {
    taskId: entry.taskId,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt?.toISOString() || null,
    durationSeconds: entry.durationSeconds,
    idleSeconds: entry.idleSeconds,
    excludedIdleSeconds: entry.excludedIdleSeconds,
    contextSwitches: entry.contextSwitches,
    locationLabel: entry.locationLabel,
    pauses: entry.pauses.map((pause) => ({ startedAt: pause.startedAt.toISOString(), endedAt: pause.endedAt?.toISOString() || null })),
    feedback: entry.feedback,
    blockers: entry.blockers.map((row) => row.blocker.name)
  }
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

export async function updateAccountSettings(userId: string, input: AccountSettingsInput) {
  const settings = { ...input.settings, ...SYSTEM_BREEZY_SETTINGS }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: input.profile
    })
    await tx.settings.upsert({
      where: { userId },
      update: settings,
      create: { userId, ...settings }
    })
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
    excluded_idle_seconds: entry.excludedIdleSeconds,
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

function coerceSettings(settings: Record<string, unknown>) {
  return {
    idleThresholdMinutes: Number(settings.idleThresholdMinutes || defaultSettings.idleThresholdMinutes),
    ...SYSTEM_BREEZY_SETTINGS,
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

type PersonalWeekEntry = {
  startedAt: Date
  durationSeconds: number
  task: { title: string, category: { name: string } }
  feedback?: { flowQuality: string, efficiencyFeel: string, energy: string } | null
  blockers: { blocker: { name: string } }[]
}

function startOfUtcWeek(value: Date) {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  return date
}

function personalWeekLabel(start: Date, end: Date) {
  const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()
  if (sameMonth) return `${month.format(start)} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`
  if (sameYear) return `${month.format(start)} ${start.getUTCDate()}–${month.format(end)} ${end.getUTCDate()}, ${end.getUTCFullYear()}`
  return `${month.format(start)} ${start.getUTCDate()}, ${start.getUTCFullYear()}–${month.format(end)} ${end.getUTCDate()}, ${end.getUTCFullYear()}`
}

function buildCompanyOverviewDays(
  entries: CompanyDashboardEntry[],
  start: Date,
  metric: CompanyDashboardMetric,
  groupBy: CompanyDashboardGrouping
) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(date.getUTCDate() + index)
    const isoDate = displayDate(date)
    const values = new Map<string, number>()
    for (const entry of entries) {
      if (displayDate(entry.startedAt) !== isoDate) continue
      const name = companyGroupingName(entry, groupBy)
      if (!name) continue
      values.set(name, (values.get(name) || 0) + companyMetricValue(entry, metric))
    }
    return {
      date: isoDate,
      label: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()]} ${date.getUTCDate()}`,
      series: [...values.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((left, right) => right.value - left.value || left.name.localeCompare(right.name))
    }
  })
}

function companyGroupingName(entry: CompanyDashboardEntry, groupBy: CompanyDashboardGrouping) {
  if (groupBy === 'category') return entry.task.category.name
  if (groupBy === 'flow') {
    return entry.feedback?.flowQuality && entry.feedback.flowQuality !== 'Skipped'
      ? entry.feedback.flowQuality
      : null
  }
  return entry.feedback?.efficiencyFeel && entry.feedback.efficiencyFeel !== 'Skipped'
    ? entry.feedback.efficiencyFeel
    : null
}

function companyMetricValue(entry: CompanyDashboardEntry, metric: CompanyDashboardMetric) {
  if (metric === 'trackedTime') return entry.durationSeconds
  if (metric === 'sessions') return 1
  return entry.contextSwitches
}

function dailySeries<T extends PersonalWeekEntry>(entries: T[], label: (entry: T) => string) {
  const buckets = new Map<string, { seconds: number, sessions: number }>()
  for (const entry of entries) {
    const name = label(entry)
    const current = buckets.get(name) || { seconds: 0, sessions: 0 }
    current.seconds += entry.durationSeconds
    current.sessions += 1
    buckets.set(name, current)
  }
  return [...buckets.entries()]
    .map(([name, value]) => ({ name, ...value, hours: Math.round((value.seconds / 3600) * 100) / 100 }))
    .sort((left, right) => right.seconds - left.seconds || left.name.localeCompare(right.name))
}

export function buildPersonalWeeks<T extends PersonalWeekEntry>(entries: T[]) {
  const weekBuckets = new Map<string, T[]>()
  for (const entry of entries) {
    const weekStart = startOfUtcWeek(new Date(entry.startedAt)).toISOString().slice(0, 10)
    const bucket = weekBuckets.get(weekStart) || []
    bucket.push(entry)
    weekBuckets.set(weekStart, bucket)
  }

  return [...weekBuckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, weekEntries]) => {
      const start = new Date(`${weekStart}T00:00:00.000Z`)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 6)
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start)
        date.setUTCDate(date.getUTCDate() + index)
        const isoDate = date.toISOString().slice(0, 10)
        const dayEntries = weekEntries.filter(entry => new Date(entry.startedAt).toISOString().slice(0, 10) === isoDate)
        const recordedFlowEntries = dayEntries.filter(entry => entry.feedback?.flowQuality && entry.feedback.flowQuality !== 'Skipped')
        return {
          date: isoDate,
          label: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()]} ${date.getUTCDate()}`,
          byCategory: dailySeries(dayEntries, entry => entry.task.category.name),
          byTask: dailySeries(dayEntries, entry => entry.task.title),
          byFlow: dailySeries(recordedFlowEntries, entry => entry.feedback!.flowQuality)
        }
      })

      return {
        weekStart,
        weekEnd: end.toISOString().slice(0, 10),
        label: personalWeekLabel(start, end),
        totalSeconds: weekEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
        days,
        blockers: blockerRollup(weekEntries, 4),
        efficiency: recordedCountBy(weekEntries, entry => entry.feedback?.efficiencyFeel),
        energy: recordedCountBy(weekEntries, entry => entry.feedback?.energy)
      }
    })
}

export function recordedCountBy<T>(entries: T[], label: (entry: T) => string | null | undefined) {
  const map = new Map<string, number>()
  for (const entry of entries) {
    const value = label(entry)
    if (!value || value === 'Skipped') continue
    map.set(value, (map.get(value) || 0) + 1)
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }))
}

export function blockerRollup(entries: Array<{ durationSeconds: number, blockers: { blocker: { name: string } }[] }>, limit = Number.POSITIVE_INFINITY) {
  const map = new Map<string, { count: number, seconds: number }>()
  for (const entry of entries) {
    for (const blocker of entry.blockers.map((item) => item.blocker.name).filter((item) => item !== 'None')) {
      const current = map.get(blocker) || { count: 0, seconds: 0 }
      current.count += 1
      current.seconds += entry.durationSeconds
      map.set(blocker, current)
    }
  }
  return [...map.entries()]
    .sort(([leftName, left], [rightName, right]) => (
      right.seconds - left.seconds
      || right.count - left.count
      || leftName.localeCompare(rightName)
    ))
    .slice(0, limit)
    .map(([name, value]) => ({ name, count: value.count, hours: roundHours(value.seconds) }))
}

export function weeklyTrend<T extends { startedAt: Date, durationSeconds: number }>(entries: T[], value: (entry: T) => number = (entry) => entry.durationSeconds / 3600) {
  const formatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const map = new Map<string, number>()
  for (const entry of entries) {
    const date = new Date(entry.startedAt)
    const day = date.getUTCDay()
    date.setUTCDate(date.getUTCDate() - day)
    const weekStart = date.toISOString().slice(0, 10)
    map.set(weekStart, Math.round(((map.get(weekStart) || 0) + value(entry)) * 10) / 10)
  }
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-8)
    .map(([weekStart, amount]) => ({
      name: formatter.format(new Date(`${weekStart}T00:00:00.000Z`)),
      value: amount
    }))
}

export function weeklyAverageTrend<T extends { startedAt: Date }>(entries: T[], value: (entry: T) => number) {
  const formatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const buckets = new Map<string, { total: number, count: number }>()

  for (const entry of entries) {
    const date = new Date(entry.startedAt)
    date.setUTCDate(date.getUTCDate() - date.getUTCDay())
    const weekStart = date.toISOString().slice(0, 10)
    const bucket = buckets.get(weekStart) || { total: 0, count: 0 }
    bucket.total += value(entry)
    bucket.count += 1
    buckets.set(weekStart, bucket)
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-8)
    .map(([weekStart, bucket]) => ({
      name: formatter.format(new Date(`${weekStart}T00:00:00.000Z`)),
      value: Math.round((bucket.total / bucket.count) * 10) / 10
    }))
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
      include: { pauses: true, feedback: true, blockers: { include: { blocker: true } } },
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
  pauses: { durationSeconds: number | null }[]
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
      breakSeconds: entry.pauses.reduce((sum, pause) => sum + (pause.durationSeconds || 0), 0),
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
