import { prisma } from '../utils/prisma'

export default defineEventHandler(async () => {
  await prisma.$queryRaw`SELECT 1`

  return {
    status: 'ok',
    service: 'ag-time-tracker',
    checkedAt: new Date().toISOString()
  }
})
