import { requireSessionUser } from '../utils/auth'
import { publicState, updateSettings } from '../utils/store'
import { booleanValue, boundedInteger, enumValue, stringArray } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ settings?: unknown }>(event)
  if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
    throw createError({ statusCode: 400, statusMessage: 'settings must be an object.' })
  }
  const input = body.settings as Record<string, unknown>
  await updateSettings(user.id, {
    idleThresholdMinutes: boundedInteger('idleThresholdMinutes', input.idleThresholdMinutes, { min: 1, max: 240 }),
    nudgeCadenceMinutes: boundedInteger('nudgeCadenceMinutes', input.nudgeCadenceMinutes, { min: 5, max: 1_440 }),
    breezyVerbosity: enumValue('breezyVerbosity', input.breezyVerbosity, ['quiet', 'gentle', 'chatty'] as const),
    muted: booleanValue('muted', input.muted),
    locationEnabled: booleanValue('locationEnabled', input.locationEnabled),
    activityEnabled: booleanValue('activityEnabled', input.activityEnabled),
    locationLabels: input.locationLabels === undefined ? [] : stringArray('locationLabels', input.locationLabels, { itemMax: 100, maxItems: 20 })
  })
  return publicState(user.id)
})
