import { clearSessionCookie, requireSessionIdentity, revokeSession } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const identity = await requireSessionIdentity(event)
  await revokeSession(identity.sessionId)
  clearSessionCookie(event)
  return { ok: true }
})
