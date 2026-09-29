import { Prisma } from '@prisma/client'
import { calculateDuration } from '../../shared/utils/time'
import { prisma } from './prisma'
import { lockOwnedEntry } from './timer-lock'

export type BreezyNudgeType = 'long-focus' | 'hydration' | 'ventilation'

export interface ApiBreezyNudge {
  id: string
  relatedEntryId: string
  type: BreezyNudgeType
  message: string
  shownAt: string
  acknowledgedAt: string | null
}

export const nudgeMessages = {
  'long-focus': 'You have been focused for a while. A short reset can help.',
  hydration: 'A sip of water could be a good reset.',
  ventilation: 'If it works for your space, this is a good moment for fresh air.'
} as const

type NudgeRow = {
  id: string
  relatedEntryId: string | null
  type: string
  message: string
  shownAt: Date
  acknowledgedAt: Date | null
}

export function mapBreezyNudge(row: NudgeRow): ApiBreezyNudge {
  if (!row.relatedEntryId) {
    throw new Error('Persisted Breezy nudges must reference a time entry.')
  }
  return {
    id: row.id,
    relatedEntryId: row.relatedEntryId,
    type: row.type as BreezyNudgeType,
    message: row.message,
    shownAt: row.shownAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() || null
  }
}

export async function claimDueBreezyNudge(
  userId: string,
  entryId: string,
  now = new Date()
): Promise<ApiBreezyNudge | null> {
  return prisma.$transaction(async (tx) => {
    const locked = await lockOwnedEntry(tx, userId, entryId)
    if (locked.ended_at) return null

    const [entry, settings, nudges] = await Promise.all([
      tx.timeEntry.findUniqueOrThrow({
        where: { id: entryId },
        include: { pauses: { orderBy: { startedAt: 'asc' } } }
      }),
      tx.settings.findUnique({ where: { userId } }),
      tx.breezyNudge.findMany({
        where: { userId, relatedEntryId: entryId },
        orderBy: { shownAt: 'asc' }
      })
    ])

    if (settings?.muted || settings?.breezyVerbosity === 'quiet') return null
    if (entry.pauses.some(pause => pause.endedAt === null)) return null

    const pending = nudges.find(nudge => nudge.acknowledgedAt === null)
    if (pending) return mapBreezyNudge(pending)

    const workingSeconds = calculateDuration(
      entry.startedAt.toISOString(),
      now.toISOString(),
      entry.pauses.map(pause => ({
        startedAt: pause.startedAt.toISOString(),
        endedAt: pause.endedAt?.toISOString() || null
      })),
      entry.excludedIdleSeconds
    )

    let type: BreezyNudgeType | null = null
    if (workingSeconds >= 45 * 60 && !nudges.some(nudge => nudge.type === 'long-focus')) {
      type = 'long-focus'
    } else {
      const cadenceCount = nudges.filter(nudge => nudge.type === 'hydration' || nudge.type === 'ventilation').length
      const cadenceMinutes = settings?.nudgeCadenceMinutes ?? 50
      if (workingSeconds >= cadenceMinutes * 60 * (cadenceCount + 1)) {
        type = cadenceCount % 2 === 0 ? 'hydration' : 'ventilation'
      }
    }

    if (!type) return null
    return mapBreezyNudge(await tx.breezyNudge.create({
      data: {
        userId,
        relatedEntryId: entryId,
        type,
        message: nudgeMessages[type],
        shownAt: now
      }
    }))
  })
}

export async function acknowledgeBreezyNudge(
  userId: string,
  nudgeId: string,
  now = new Date()
): Promise<ApiBreezyNudge> {
  return prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM breezy_nudges
      WHERE id = ${nudgeId}
        AND user_id = ${userId}
      FOR UPDATE
    `)
    if (!locked) throw createError({ statusCode: 404, statusMessage: 'Breezy nudge not found.' })

    const existing = await tx.breezyNudge.findUniqueOrThrow({ where: { id: nudgeId } })
    const acknowledged = existing.acknowledgedAt
      ? existing
      : await tx.breezyNudge.update({
          where: { id: nudgeId },
          data: { acknowledgedAt: now }
        })
    return mapBreezyNudge(acknowledged)
  })
}
