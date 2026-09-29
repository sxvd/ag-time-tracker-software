import { requireSessionUser } from '../utils/auth'
import { publicState, shareTask } from '../utils/store'
import { requiredString, stringArray } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await shareTask({
    taskId: requiredString('taskId', body.taskId, { max: 128 }),
    senderId: user.id,
    recipientIds: stringArray('recipientIds', body.recipientIds, { itemMax: 128, maxItems: 100 })
  })
  return publicState(user.id)
})
