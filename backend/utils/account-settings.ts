import type { AccountSettingsInput } from '../../shared/types/account-settings'
import { SYSTEM_BREEZY_SETTINGS } from '../../shared/constants/account-settings.mjs'
import { DEFAULT_CATEGORY_NAMES } from '../../shared/constants/categories.mjs'
import { booleanValue, boundedInteger, requiredString, stringArray } from './validation'

export function parseAccountSettingsInput(value: unknown): AccountSettingsInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError({ statusCode: 400, statusMessage: 'account settings body must be an object.' })
  }

  const body = value as Record<string, unknown>
  if (!body.profile || typeof body.profile !== 'object' || Array.isArray(body.profile)) {
    throw createError({ statusCode: 400, statusMessage: 'profile must be an object.' })
  }
  if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) {
    throw createError({ statusCode: 400, statusMessage: 'settings must be an object.' })
  }

  const profile = body.profile as Record<string, unknown>
  const settings = body.settings as Record<string, unknown>
  const team = requiredString('team', profile.team, { max: 80 })
  if (!DEFAULT_CATEGORY_NAMES.includes(team)) {
    throw createError({
      statusCode: 400,
      statusMessage: `team must be one of: ${DEFAULT_CATEGORY_NAMES.join(', ')}.`
    })
  }
  return {
    profile: {
      displayName: requiredString('displayName', profile.displayName, { max: 100 }),
      team
    },
    settings: {
      idleThresholdMinutes: boundedInteger('idleThresholdMinutes', settings.idleThresholdMinutes, { min: 1, max: 240 }),
      ...SYSTEM_BREEZY_SETTINGS,
      locationEnabled: booleanValue('locationEnabled', settings.locationEnabled),
      activityEnabled: booleanValue('activityEnabled', settings.activityEnabled),
      locationLabels: stringArray('locationLabels', settings.locationLabels, { itemMax: 100, maxItems: 20 })
    }
  }
}
