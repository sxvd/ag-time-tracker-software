import { requireSessionUser } from '../utils/auth'
import { publicState, updateSettings } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ settings: Record<string, unknown> }>(event)
  await updateSettings(user.id, body.settings || {})
  return publicState(user.id)
})
