import { requireSessionUser } from '../utils/auth'
import { createManualEntry, publicState } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody(event)
  await createManualEntry({ ...body, userId: user.id })
  return publicState(user.id)
})
