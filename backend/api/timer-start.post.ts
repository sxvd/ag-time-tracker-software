import { requireSessionUser } from '../utils/auth'
import { publicState, startEntry } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ taskId: string }>(event)
  await startEntry({ taskId: body.taskId, userId: user.id })
  return publicState(user.id)
})
