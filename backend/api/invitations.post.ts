import { requireSessionUser } from '../utils/auth'
import { acceptTaskInvitation, publicState } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ invitationId: string }>(event)
  await acceptTaskInvitation({ invitationId: body.invitationId, userId: user.id })
  return publicState(user.id)
})
