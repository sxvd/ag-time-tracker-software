import { PrismaClient } from '@prisma/client'
import { randomBytes, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'

const prisma = new PrismaClient()
const scrypt = promisify(scryptCallback)

const defaultBlockers = [
  'Waiting on someone',
  'Tool was slow or broke',
  'Unclear requirements',
  'Interruptions',
  'Context switching',
  'Meetings overran',
  'None'
]

const medalDefinitions = [
  ['m1', 'flow-state', 'Flow State', 'Logged a great-flow session.'],
  ['m2', 'steady-breeze', 'Steady Breeze', 'Tracked across five sessions.'],
  ['m3', 'in-the-zone', 'In the Zone', 'Tracked eight honest hours.'],
  ['m4', 'straight-shooter', 'Straight Shooter', 'Named a real blocker.'],
  ['m5', 'sustainable-pace', 'Sustainable Pace', 'Protected rest or break time.'],
  ['m6', 'single-tasker', 'Single-Tasker', 'Kept a focused session calm.'],
  ['m7', 'fresh-air', 'Fresh Air', 'Opened space for a reset.'],
  ['m8', 'clear-skies', 'Clear Skies', 'Finished a blocker-free day.']
]

const now = new Date('2026-06-09T08:30:00.000Z')

function iso(daysAgo, hour, minute = 0) {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  date.setUTCHours(hour, minute, 0, 0)
  return date.toISOString()
}

function secondsBetween(startedAt, endedAt) {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
}

function calculateDuration(startedAt, endedAt, pauses = [], idleSeconds = 0) {
  const pauseSeconds = pauses.reduce((sum, pause) => sum + secondsBetween(pause.startedAt, pause.endedAt), 0)
  return Math.max(0, secondsBetween(startedAt, endedAt) - pauseSeconds - idleSeconds)
}

function deriveBreezyDay(sessions) {
  const trackedHours = sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 3600
  const greatFlow = sessions.filter((session) => session.flowQuality === 'Great flow').length
  const friction = sessions.filter((session) => session.flowQuality === 'Friction').length
  const switches = sessions.reduce((sum, session) => sum + session.contextSwitches, 0)
  const blockers = sessions.reduce((sum, session) => sum + (session.blockers?.filter((blocker) => blocker !== 'None').length || 0), 0)
  const breaks = sessions.reduce((sum, session) => sum + session.idleSeconds, 0)
  const airClarityScore = Math.max(30, Math.min(100, Math.round(70 + greatFlow * 8 + Math.min(breaks / 300, 10) - friction * 9 - switches * 1.5 - blockers * 5)))
  let mood = 'idle'
  if (airClarityScore >= 86 && trackedHours > 0) mood = 'cheering'
  else if (airClarityScore >= 74) mood = 'happy'
  else if (airClarityScore >= 55) mood = 'waving'
  else mood = 'sleepy'
  return { mood, airClarityScore }
}

function awardMedals(sessions) {
  const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0)
  const blockers = sessions.flatMap((session) => session.blockers || [])
  const medals = new Set()
  if (sessions.some((session) => session.flowQuality === 'Great flow')) medals.add('flow-state')
  if (sessions.length >= 5) medals.add('steady-breeze')
  if (totalSeconds >= 8 * 3600) medals.add('in-the-zone')
  if (blockers.some((blocker) => blocker !== 'None')) medals.add('straight-shooter')
  if (sessions.some((session) => session.idleSeconds >= 300)) medals.add('sustainable-pace')
  if (sessions.some((session) => session.contextSwitches <= 1 && session.durationSeconds >= 1800)) medals.add('single-tasker')
  return [...medals]
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url')
  const derivedKey = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${derivedKey.toString('base64url')}`
}

function seededEntries() {
  const rows = [
    {
      taskId: 't1',
      userId: 'u1',
      startedAt: iso(0, 2, 15),
      endedAt: iso(0, 3, 40),
      isManual: false,
      idleSeconds: 360,
      contextSwitches: 2,
      locationLabel: 'Home office',
      pauses: [],
      feedback: { flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High', note: 'Clear review pass.' },
      blockers: ['None']
    },
    {
      taskId: 't2',
      userId: 'u1',
      startedAt: iso(0, 4, 0),
      endedAt: iso(0, 4, 46),
      isManual: false,
      idleSeconds: 0,
      contextSwitches: 5,
      locationLabel: 'AirGradient office',
      pauses: [],
      feedback: { flowQuality: 'Friction', efficiencyFeel: 'Felt manual', energy: 'OK', note: 'Meeting overran by a few minutes.' },
      blockers: ['Meetings overran', 'Unclear requirements']
    },
    {
      taskId: 't1',
      userId: 'u2',
      startedAt: iso(1, 3, 5),
      endedAt: iso(1, 4, 30),
      isManual: false,
      idleSeconds: 180,
      contextSwitches: 1,
      locationLabel: 'Lab',
      pauses: [],
      feedback: { flowQuality: 'Neutral', efficiencyFeel: 'Felt efficient', energy: 'OK', note: '' },
      blockers: ['Waiting on someone']
    }
  ]

  for (let day = 2; day <= 31; day += 3) {
    rows.push({
      taskId: day % 2 ? 't1' : 't3',
      userId: day % 2 ? 'u1' : 'u2',
      startedAt: iso(day, 2, 0),
      endedAt: iso(day, 3 + (day % 3), 15),
      isManual: day % 5 === 0,
      idleSeconds: day % 4 === 0 ? 420 : 60,
      contextSwitches: day % 6,
      locationLabel: day % 2 ? 'Home office' : 'Lab',
      pauses: [],
      feedback: {
        flowQuality: day % 4 === 0 ? 'Friction' : day % 3 === 0 ? 'Great flow' : 'Neutral',
        efficiencyFeel: day % 4 === 0 ? 'Felt manual' : 'Felt efficient',
        energy: day % 5 === 0 ? 'Drained' : 'OK',
        note: ''
      },
      blockers: day % 4 === 0 ? ['Context switching'] : ['None']
    })
  }

  return rows.map((entry, index) => ({
    ...entry,
    id: `e${index + 1}`,
    durationSeconds: calculateDuration(entry.startedAt, entry.endedAt, entry.pauses, entry.idleSeconds),
    createdAt: entry.startedAt
  }))
}

async function main() {
  const demoPasswordHash = await hashPassword('demo')

  await prisma.user.upsert({
    where: { id: 'u1' },
    update: { email: 'siri@airgradient.com', displayName: 'Siri', team: 'Software', passwordHash: demoPasswordHash },
    create: { id: 'u1', email: 'siri@airgradient.com', displayName: 'Siri', team: 'Software', passwordHash: demoPasswordHash }
  })
  await prisma.user.upsert({
    where: { id: 'u2' },
    update: { email: 'jack@airgradient.com', displayName: 'Jack', team: 'Hardware', passwordHash: demoPasswordHash },
    create: { id: 'u2', email: 'jack@airgradient.com', displayName: 'Jack', team: 'Hardware', passwordHash: demoPasswordHash }
  })
  await prisma.user.upsert({
    where: { id: 'u3' },
    update: { email: 'jay@airgradient.com', displayName: 'Jay', team: 'COMMS', passwordHash: demoPasswordHash },
    create: { id: 'u3', email: 'jay@airgradient.com', displayName: 'Jay', team: 'COMMS', passwordHash: demoPasswordHash }
  })

  for (const [index, name] of ['Deep work', 'Meeting', 'Admin', 'Comms', 'Research', 'Other'].entries()) {
    await prisma.category.upsert({
      where: { id: `c${index + 1}` },
      update: { ownerId: null, name },
      create: { id: `c${index + 1}`, ownerId: null, name }
    })
  }

  await prisma.client.upsert({
    where: { id: 'cl1' },
    update: { name: 'AirGradient', createdByUserId: 'u1' },
    create: { id: 'cl1', name: 'AirGradient', createdByUserId: 'u1' }
  })
  await prisma.client.upsert({
    where: { id: 'cl2' },
    update: { name: 'Open Air Lab', createdByUserId: 'u1' },
    create: { id: 'cl2', name: 'Open Air Lab', createdByUserId: 'u1' }
  })

  await prisma.project.upsert({
    where: { id: 'p1' },
    update: { clientId: 'cl1', name: 'Breezy Time Tracker', description: 'Internal focus and process insight.', createdByUserId: 'u1' },
    create: { id: 'p1', clientId: 'cl1', name: 'Breezy Time Tracker', description: 'Internal focus and process insight.', createdByUserId: 'u1' }
  })
  await prisma.project.upsert({
    where: { id: 'p2' },
    update: { clientId: 'cl1', name: 'Firmware Quality', description: 'Reduce manual validation loops.', createdByUserId: 'u2' },
    create: { id: 'p2', clientId: 'cl1', name: 'Firmware Quality', description: 'Reduce manual validation loops.', createdByUserId: 'u2' }
  })

  const tasks = [
    ['t1', 'Deep work: PCB layout review', 'Review board layout feedback and note open questions.', 'c1', 'cl1', 'p1', 90, 'u1', true, iso(20, 8)],
    ['t2', 'Weekly process retro', 'Surface workflow friction from the past week.', 'c2', 'cl1', 'p1', 45, 'u1', true, iso(12, 9)],
    ['t3', 'Sensor QA notes', 'Consolidate firmware validation notes.', 'c5', 'cl1', 'p2', 120, 'u2', false, iso(8, 10)]
  ]

  for (const [id, title, description, categoryId, clientId, projectId, estimateMinutes, ownerId, isShared, createdAt] of tasks) {
    await prisma.task.upsert({
      where: { id },
      update: { title, description, categoryId, clientId, projectId, estimateMinutes, ownerId, isShared, isArchived: false, createdAt: new Date(createdAt) },
      create: { id, title, description, categoryId, clientId, projectId, estimateMinutes, ownerId, isShared, isArchived: false, createdAt: new Date(createdAt) }
    })
  }

  await prisma.taskMember.createMany({
    data: [
      { taskId: 't1', userId: 'u1', role: 'owner', invitedByUserId: 'u1', joinedAt: new Date(iso(20, 8)) },
      { taskId: 't1', userId: 'u2', role: 'member', invitedByUserId: 'u1', joinedAt: new Date(iso(19, 8)) },
      { taskId: 't2', userId: 'u1', role: 'owner', invitedByUserId: 'u1', joinedAt: new Date(iso(12, 9)) },
      { taskId: 't2', userId: 'u3', role: 'member', invitedByUserId: 'u1', joinedAt: new Date(iso(12, 10)) },
      { taskId: 't3', userId: 'u2', role: 'owner', invitedByUserId: 'u2', joinedAt: new Date(iso(8, 10)) }
    ],
    skipDuplicates: true
  })

  await prisma.taskInvite.upsert({
    where: { id: 'ti1' },
    update: { taskId: 't2', senderId: 'u1', recipientId: 'u2', status: 'pending', respondedAt: null },
    create: { id: 'ti1', taskId: 't2', senderId: 'u1', recipientId: 'u2', status: 'pending', createdAt: new Date(iso(0, 1, 30)) }
  })

  for (const [index, name] of defaultBlockers.entries()) {
    await prisma.blocker.upsert({
      where: { name },
      update: { id: `b${index + 1}`, isDefault: true },
      create: { id: `b${index + 1}`, name, isDefault: true }
    })
  }
  const blockerByName = Object.fromEntries(defaultBlockers.map((name, index) => [name, `b${index + 1}`]))

  await prisma.settings.upsert({
    where: { userId: 'u1' },
    update: {
      idleThresholdMinutes: 5,
      nudgeCadenceMinutes: 90,
      breezyVerbosity: 'gentle',
      muted: false,
      locationEnabled: false,
      activityEnabled: true,
      locationLabels: ['Home office', 'AirGradient office']
    },
    create: {
      userId: 'u1',
      idleThresholdMinutes: 5,
      nudgeCadenceMinutes: 90,
      breezyVerbosity: 'gentle',
      muted: false,
      locationEnabled: false,
      activityEnabled: true,
      locationLabels: ['Home office', 'AirGradient office']
    }
  })

  const entries = seededEntries()
  for (const entry of entries) {
    await prisma.timeEntry.upsert({
      where: { id: entry.id },
      update: {
        taskId: entry.taskId,
        userId: entry.userId,
        startedAt: new Date(entry.startedAt),
        endedAt: new Date(entry.endedAt),
        durationSeconds: entry.durationSeconds,
        isManual: entry.isManual,
        idleSeconds: entry.idleSeconds,
        contextSwitches: entry.contextSwitches,
        locationLabel: entry.locationLabel,
        createdAt: new Date(entry.createdAt)
      },
      create: {
        id: entry.id,
        taskId: entry.taskId,
        userId: entry.userId,
        startedAt: new Date(entry.startedAt),
        endedAt: new Date(entry.endedAt),
        durationSeconds: entry.durationSeconds,
        isManual: entry.isManual,
        idleSeconds: entry.idleSeconds,
        contextSwitches: entry.contextSwitches,
        locationLabel: entry.locationLabel,
        createdAt: new Date(entry.createdAt)
      }
    })

    await prisma.entryFeedback.upsert({
      where: { entryId: entry.id },
      update: entry.feedback,
      create: { entryId: entry.id, ...entry.feedback }
    })

    await prisma.entryBlocker.deleteMany({ where: { entryId: entry.id } })
    await prisma.entryBlocker.createMany({
      data: entry.blockers.map((name) => ({ entryId: entry.id, blockerId: blockerByName[name] })),
      skipDuplicates: true
    })

    if (entry.isManual) {
      await prisma.entryAuditEvent.upsert({
        where: { id: `audit-${entry.id}` },
        update: { eventType: 'manual_created', changes: { seeded: true } },
        create: { id: `audit-${entry.id}`, entryId: entry.id, userId: entry.userId, eventType: 'manual_created', changes: { seeded: true } }
      })
    }
  }

  for (const [id, code, name, description] of medalDefinitions) {
    await prisma.medal.upsert({
      where: { code },
      update: { name, description },
      create: { id, code, name, description }
    })
  }

  for (const userId of ['u1', 'u2', 'u3']) {
    const userEntries = entries.filter((entry) => entry.userId === userId)
    const days = new Map()
    for (const entry of userEntries) {
      const key = entry.startedAt.slice(0, 10)
      days.set(key, [...(days.get(key) || []), entry])
    }
    for (const [date, dayEntries] of days.entries()) {
      const derived = deriveBreezyDay(dayEntries.map((entry) => ({
        durationSeconds: entry.durationSeconds,
        flowQuality: entry.feedback.flowQuality,
        efficiencyFeel: entry.feedback.efficiencyFeel,
        energy: entry.feedback.energy,
        blockers: entry.blockers,
        idleSeconds: entry.idleSeconds,
        contextSwitches: entry.contextSwitches
      })))
      await prisma.breezyDay.upsert({
        where: { userId_date: { userId, date: new Date(`${date}T00:00:00.000Z`) } },
        update: { breezyMood: derived.mood, airClarityScore: derived.airClarityScore },
        create: { userId, date: new Date(`${date}T00:00:00.000Z`), breezyMood: derived.mood, airClarityScore: derived.airClarityScore }
      })
    }

    const awardedCodes = awardMedals(userEntries.map((entry) => ({
      durationSeconds: entry.durationSeconds,
      flowQuality: entry.feedback.flowQuality,
      efficiencyFeel: entry.feedback.efficiencyFeel,
      energy: entry.feedback.energy,
      blockers: entry.blockers,
      idleSeconds: entry.idleSeconds,
      contextSwitches: entry.contextSwitches
    })))
    await prisma.userMedal.deleteMany({ where: { userId } })
    const medals = await prisma.medal.findMany({ where: { code: { in: awardedCodes } } })
    await prisma.userMedal.createMany({
      data: medals.map((medal) => ({ userId, medalId: medal.id })),
      skipDuplicates: true
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
