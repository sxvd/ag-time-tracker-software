import { requireSessionUser } from '../utils/auth'
import { publicState, startEntry } from '../utils/store'
import { optionalString, requiredString } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await startEntry({
    taskId: requiredString('taskId', body.taskId, { max: 128 }),
    userId: user.id,
    locationLabel: optionalString('locationLabel', body.locationLabel, { max: 100 })
  })
  return publicState(user.id)
})
