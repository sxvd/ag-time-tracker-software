import { requireSessionUser } from '../utils/auth'
import { publicState, updateProfile } from '../utils/store'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const body = await readBody<{ displayName?: string, team?: string }>(event)
  await updateProfile(sessionUser.id, body)
  return publicState(sessionUser.id)
})
