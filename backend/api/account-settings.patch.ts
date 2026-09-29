import { parseAccountSettingsInput } from '../utils/account-settings'
import { requireSessionUser } from '../utils/auth'
import { publicState, updateAccountSettings } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const input = parseAccountSettingsInput(await readBody(event))
  await updateAccountSettings(user.id, input)
  return publicState(user.id)
})
