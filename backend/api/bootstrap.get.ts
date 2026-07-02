import { requireSessionUser } from '../utils/auth'
import { publicState } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const query = getQuery(event)
  return publicState(user.id, String(query.team || 'All'))
})
