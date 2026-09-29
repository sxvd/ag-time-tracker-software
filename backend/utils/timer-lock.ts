import { Prisma } from '@prisma/client'

export interface LockedEntryRow {
  id: string
  ended_at: Date | null
}

export async function lockOwnedEntry(
  tx: Prisma.TransactionClient,
  userId: string,
  entryId: string
) {
  const [entry] = await tx.$queryRaw<LockedEntryRow[]>(Prisma.sql`
    SELECT id, ended_at
    FROM time_entries
    WHERE id = ${entryId}
      AND user_id = ${userId}
    FOR UPDATE
  `)
  if (!entry) throw createError({ statusCode: 404, statusMessage: 'Entry not found.' })
  return entry
}

export async function lockActiveEntry(
  tx: Prisma.TransactionClient,
  userId: string,
  entryId: string
) {
  const entry = await lockOwnedEntry(tx, userId, entryId)
  if (entry.ended_at) throw createError({ statusCode: 404, statusMessage: 'Active entry not found.' })
  return entry
}
