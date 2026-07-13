import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { calculateDuration } from '../../shared/utils/time'

export async function pauseActiveEntry(userId: string, entryId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId, endedAt: null },
    include: { pauses: true }
  })
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Active entry not found.' })
  if (entry.pauses.some((pause) => pause.endedAt === null)) {
    throw createError({ statusCode: 409, statusMessage: 'Timer is already paused.' })
  }

  try {
    return await prisma.entryPause.create({
      data: { entryId, startedAt: new Date() }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'Timer is already paused.' })
    }
    throw error
  }
}

export async function resumeActiveEntry(userId: string, entryId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId, endedAt: null },
    include: { pauses: true }
  })
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Active entry not found.' })

  const openPause = entry.pauses.find((pause) => pause.endedAt === null)
  if (!openPause) throw createError({ statusCode: 409, statusMessage: 'Timer is not paused.' })

  const endedAt = new Date()
  const result = await prisma.entryPause.updateMany({
    where: { id: openPause.id, endedAt: null },
    data: {
      endedAt,
      durationSeconds: calculateDuration(openPause.startedAt.toISOString(), endedAt.toISOString())
    }
  })
  if (result.count !== 1) throw createError({ statusCode: 409, statusMessage: 'Timer is not paused.' })
  return prisma.entryPause.findUniqueOrThrow({ where: { id: openPause.id } })
}
