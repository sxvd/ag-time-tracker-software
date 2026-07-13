import { requireSessionUser } from '../utils/auth'
import { acceptTaskInvitation, publicState } from '../utils/store'
import { requiredString } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await acceptTaskInvitation({ invitationId: requiredString('invitationId', body.invitationId, { max: 128 }), userId: user.id })
  return publicState(user.id)
})
