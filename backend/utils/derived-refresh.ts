import { Prisma } from '@prisma/client'
import { awardMedals, deriveBreezyDay } from '../../shared/utils/time'
import type { EfficiencyFeel, EnergyLevel, FlowQuality } from '../../shared/utils/time'
import { prisma } from './prisma'

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.slice(0, 2_000)
}

export async function enqueueDerivedRefresh(
  tx: Prisma.TransactionClient,
  userId: string
) {
  return tx.derivedRefreshJob.upsert({
    where: { userId },
    update: {
      requestedAt: new Date(),
      attemptCount: 0,
      lastError: null,
      completedAt: null
    },
    create: { userId }
  })
}

export async function processDerivedRefresh(userId: string) {
  const job = await prisma.derivedRefreshJob.findUnique({ where: { userId } })
  if (!job || job.completedAt) return false

  try {
    return await prisma.$transaction(async (tx) => {
      const [lockedJob] = await tx.$queryRaw<Array<{
        requested_at: Date
        completed_at: Date | null
      }>>(Prisma.sql`
        SELECT requested_at, completed_at
        FROM derived_refresh_jobs
        WHERE user_id = ${userId}
        FOR UPDATE
      `)
      if (
        !lockedJob
        || lockedJob.completed_at
        || lockedJob.requested_at.getTime() !== job.requestedAt.getTime()
      ) {
        return false
      }

      const entries = await tx.timeEntry.findMany({
        where: { userId, endedAt: { not: null } },
        include: { pauses: true, feedback: true, blockers: { include: { blocker: true } } }
      })
      const byDate = new Map<string, typeof entries>()
      for (const entry of entries) {
        const key = dateKey(entry.startedAt)
        byDate.set(key, [...(byDate.get(key) || []), entry])
      }

      const days = [...byDate.entries()].map(([date, dayEntries]) => {
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
          date: new Date(`${date}T00:00:00.000Z`),
          breezyMood: derived.mood,
          airClarityScore: derived.airClarityScore
        }
      })

      const awardedCodes = awardMedals(entries.map((entry) => ({
        durationSeconds: entry.durationSeconds,
        flowQuality: entry.feedback?.flowQuality as FlowQuality | undefined,
        efficiencyFeel: entry.feedback?.efficiencyFeel as EfficiencyFeel | undefined,
        energy: entry.feedback?.energy as EnergyLevel | undefined,
        blockers: entry.blockers.map((row) => row.blocker.name),
        idleSeconds: entry.idleSeconds,
        breakSeconds: entry.pauses.reduce((sum, pause) => sum + (pause.durationSeconds || 0), 0),
        contextSwitches: entry.contextSwitches
      })))
      const medals = await tx.medal.findMany({
        where: { code: { in: awardedCodes } }
      })

      if (days.length) {
        await tx.breezyDay.deleteMany({
          where: { userId, date: { notIn: days.map((day) => day.date) } }
        })
      } else {
        await tx.breezyDay.deleteMany({ where: { userId } })
      }
      for (const day of days) {
        await tx.breezyDay.upsert({
          where: { userId_date: { userId, date: day.date } },
          update: {
            breezyMood: day.breezyMood,
            airClarityScore: day.airClarityScore
          },
          create: { userId, ...day }
        })
      }

      if (medals.length) {
        await tx.userMedal.deleteMany({
          where: { userId, medalId: { notIn: medals.map((medal) => medal.id) } }
        })
      } else {
        await tx.userMedal.deleteMany({ where: { userId } })
      }
      for (const medal of medals) {
        await tx.userMedal.upsert({
          where: { userId_medalId: { userId, medalId: medal.id } },
          update: {},
          create: { userId, medalId: medal.id }
        })
      }

      await tx.derivedRefreshJob.update({
        where: { userId },
        data: {
          completedAt: new Date(),
          lastError: null
        }
      })
      return true
    })
  } catch (error) {
    await prisma.derivedRefreshJob.updateMany({
      where: {
        userId,
        requestedAt: job.requestedAt,
        completedAt: null
      },
      data: {
        attemptCount: { increment: 1 },
        lastError: errorMessage(error)
      }
    })
    return false
  }
}

export async function retryPendingDerivedRefresh(userId: string) {
  const pending = await prisma.derivedRefreshJob.findFirst({
    where: { userId, completedAt: null }
  })
  if (!pending) return false
  return processDerivedRefresh(userId)
}
