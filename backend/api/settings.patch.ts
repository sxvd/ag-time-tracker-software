import { requireSessionUser } from '../utils/auth'
import { publicState, updateSettings } from '../utils/store'
import { booleanValue, boundedInteger, stringArray } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ settings?: unknown }>(event)
  if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
    throw createError({ statusCode: 400, statusMessage: 'settings must be an object.' })
  }
  const input = body.settings as Record<string, unknown>
  await updateSettings(user.id, {
    idleThresholdMinutes: boundedInteger('idleThresholdMinutes', input.idleThresholdMinutes, { min: 1, max: 240 }),
    locationEnabled: booleanValue('locationEnabled', input.locationEnabled),
    activityEnabled: booleanValue('activityEnabled', input.activityEnabled),
    locationLabels: input.locationLabels === undefined ? [] : stringArray('locationLabels', input.locationLabels, { itemMax: 100, maxItems: 20 })
  })
  return publicState(user.id)
})
