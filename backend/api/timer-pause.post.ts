import { requireSessionUser } from '../utils/auth'
import { publicState } from '../utils/store'
import { pauseActiveEntry } from '../utils/timer-activity'
import { requiredString } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await pauseActiveEntry(user.id, requiredString('entryId', body.entryId, { max: 128 }))
  return publicState(user.id)
})
