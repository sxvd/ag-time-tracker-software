import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  __breezyPrisma?: PrismaClient
}

export const prisma = globalForPrisma.__breezyPrisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__breezyPrisma = prisma
}
