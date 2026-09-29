import { requireSessionUser } from '../utils/auth'
import { recordContextSwitch } from '../utils/timer-activity'
import { requiredString } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  const entryId = requiredString('entryId', body.entryId, { max: 128 })
  const contextSwitches = await recordContextSwitch(user.id, entryId)
  return { entryId, contextSwitches }
})
