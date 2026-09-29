import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { calculateDuration, secondsBetween, shouldRecordContextSwitch } from '../../shared/utils/time'
import type { IdleDecision } from '../../shared/utils/time'
import { lockActiveEntry, lockOwnedEntry } from './timer-lock'

export { shouldRecordContextSwitch }

export async function recordContextSwitch(userId: string, entryId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId, endedAt: null },
    select: {
      id: true,
      pauses: {
        where: { endedAt: null },
        select: { id: true }
      },
      user: {
        select: {
          settings: {
            select: { activityEnabled: true }
          }
        }
      }
    }
  })
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Active entry not found.' })
  if (entry.pauses.length) {
    throw createError({ statusCode: 409, statusMessage: 'Context switches are not recorded while paused.' })
  }
  if (entry.user.settings?.activityEnabled === false) {
    throw createError({ statusCode: 409, statusMessage: 'Activity tracking is disabled.' })
  }

  const result = await prisma.timeEntry.updateMany({
    where: {
      id: entryId,
      userId,
      endedAt: null,
      pauses: { none: { endedAt: null } }
    },
    data: {
      contextSwitches: { increment: 1 }
    }
  })
  if (result.count !== 1) {
    throw createError({ statusCode: 409, statusMessage: 'Timer state changed before the context switch was saved.' })
  }

  const updated = await prisma.timeEntry.findUniqueOrThrow({
    where: { id: entryId },
    select: { contextSwitches: true }
  })
  return updated.contextSwitches
}

export async function pauseActiveEntry(userId: string, entryId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      await lockActiveEntry(tx, userId, entryId)
      const openPause = await tx.entryPause.findFirst({ where: { entryId, endedAt: null } })
      if (openPause) {
        throw createError({ statusCode: 409, statusMessage: 'Timer is already paused.' })
      }
      return tx.entryPause.create({
        data: { entryId, startedAt: new Date() }
      })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Timer is already paused.' })
    }
    throw error
  }
}

export async function resumeActiveEntry(userId: string, entryId: string) {
  return prisma.$transaction(async (tx) => {
    await lockActiveEntry(tx, userId, entryId)
    const openPause = await tx.entryPause.findFirst({ where: { entryId, endedAt: null } })
    if (!openPause) throw createError({ statusCode: 409, statusMessage: 'Timer is not paused.' })

    const endedAt = new Date()
    const result = await tx.entryPause.updateMany({
      where: { id: openPause.id, endedAt: null },
      data: {
        endedAt,
        durationSeconds: calculateDuration(openPause.startedAt.toISOString(), endedAt.toISOString())
      }
    })
    if (result.count !== 1) throw createError({ statusCode: 409, statusMessage: 'Timer is not paused.' })
    return tx.entryPause.findUniqueOrThrow({ where: { id: openPause.id } })
  })
}

export interface IdleDecisionInput {
  decisionId: string
  decision: IdleDecision
  startedAt: string
  endedAt: string
}

export async function recordIdleDecision(
  userId: string,
  entryId: string,
  input: IdleDecisionInput
) {
  const decisionId = String(input.decisionId || '').trim()
  if (!decisionId || decisionId.length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'decisionId is required and must be at most 128 characters.' })
  }
  if (!['keep', 'discard', 'break'].includes(input.decision)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid idle decision.' })
  }
  const startedAt = new Date(input.startedAt)
  const endedAt = new Date(input.endedAt)
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime()) || endedAt <= startedAt) {
    throw createError({ statusCode: 400, statusMessage: 'Idle interval must have valid start and end times.' })
  }
  const idleSeconds = secondsBetween(startedAt, endedAt)
  if (idleSeconds > 24 * 60 * 60) {
    throw createError({ statusCode: 400, statusMessage: 'Idle interval must not exceed 24 hours.' })
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const lockedEntry = await lockOwnedEntry(tx, userId, entryId)

      const existingDecision = await tx.entryIdleDecision.findUnique({
        where: { entryId_decisionId: { entryId, decisionId } }
      })
      if (existingDecision) {
        const matches = existingDecision.decision === input.decision
          && existingDecision.startedAt.getTime() === startedAt.getTime()
          && existingDecision.endedAt.getTime() === endedAt.getTime()
        if (!matches) {
          throw createError({ statusCode: 409, statusMessage: 'Idle decision identity was already used for another interval.' })
        }
        return tx.timeEntry.findUniqueOrThrow({
          where: { id: entryId },
          include: {
            pauses: true,
            feedback: true,
            blockers: { include: { blocker: true } }
          }
        })
      }
      if (lockedEntry.ended_at) {
        throw createError({ statusCode: 404, statusMessage: 'Active entry not found.' })
      }

      const entry = await tx.timeEntry.findUniqueOrThrow({
        where: { id: entryId },
        include: {
          pauses: true,
          user: { select: { settings: { select: { activityEnabled: true } } } }
        }
      })
      if (entry.user.settings?.activityEnabled === false) {
        throw createError({ statusCode: 409, statusMessage: 'Activity tracking is disabled.' })
      }
      if (
        startedAt < entry.startedAt
        || endedAt > new Date()
      ) {
        throw createError({ statusCode: 400, statusMessage: 'Idle interval must stay inside the active entry.' })
      }
      if (entry.pauses.some((pause) => (
        pause.endedAt === null
        || (startedAt < pause.endedAt && endedAt > pause.startedAt)
      ))) {
        throw createError({ statusCode: 409, statusMessage: 'Idle interval overlaps an existing pause.' })
      }
      const overlappingDecision = await tx.entryIdleDecision.findFirst({
        where: {
          entryId,
          startedAt: { lt: endedAt },
          endedAt: { gt: startedAt }
        }
      })
      if (overlappingDecision) {
        throw createError({ statusCode: 409, statusMessage: 'Idle interval was already recorded.' })
      }

      await tx.entryIdleDecision.create({
        data: {
          entryId,
          decisionId,
          decision: input.decision,
          startedAt,
          endedAt,
          idleSeconds
        }
      })
      if (input.decision === 'break') {
        await tx.entryPause.create({
          data: {
            entryId,
            startedAt,
            endedAt,
            durationSeconds: idleSeconds
          }
        })
      }
      return tx.timeEntry.update({
        where: { id: entryId },
        data: {
          idleSeconds: { increment: idleSeconds },
          ...(input.decision === 'discard'
            ? { excludedIdleSeconds: { increment: idleSeconds } }
            : {})
        },
        include: {
          pauses: true,
          feedback: true,
          blockers: { include: { blocker: true } }
        }
      })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Idle decision was already recorded.' })
    }
    throw error
  }
}
