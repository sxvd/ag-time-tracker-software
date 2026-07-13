import { requireSessionUser } from '../utils/auth'
import { publicState, updateProfile } from '../utils/store'
import { optionalString } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await updateProfile(sessionUser.id, {
    displayName: optionalString('displayName', body.displayName, { max: 100 }),
    team: optionalString('team', body.team, { max: 80 })
  })
  return publicState(sessionUser.id)
})
