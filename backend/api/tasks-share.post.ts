import { requireSessionUser } from '../utils/auth'
import { publicState, shareTask } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ taskId: string, recipientIds: string[] }>(event)
  await shareTask({ taskId: body.taskId, senderId: user.id, recipientIds: body.recipientIds || [] })
  return publicState(user.id)
})
