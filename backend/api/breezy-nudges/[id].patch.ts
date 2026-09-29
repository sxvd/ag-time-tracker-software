import { requireSessionUser } from '../../utils/auth'
import { acknowledgeBreezyNudge } from '../../utils/breezy-nudges'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const nudgeId = getRouterParam(event, 'id') || ''
  return { nudge: await acknowledgeBreezyNudge(user.id, nudgeId) }
})
