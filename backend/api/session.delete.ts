import { clearSessionCookie, requireSessionUser, revokeUserSessions } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await revokeUserSessions(user.id)
  clearSessionCookie(event)
  return { ok: true }
})
