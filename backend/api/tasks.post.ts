import { requireSessionUser } from '../utils/auth'
import { createTask, publicState } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody(event)
  await createTask({ ...body, ownerId: user.id })
  return publicState(user.id)
})
