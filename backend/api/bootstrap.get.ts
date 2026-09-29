import { requireSessionUser } from '../utils/auth'
import { retryPendingDerivedRefresh } from '../utils/derived-refresh'
import { publicState } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  await retryPendingDerivedRefresh(user.id)
  return publicState(user.id)
})
