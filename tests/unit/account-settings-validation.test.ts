import { createError } from 'h3'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseAccountSettingsInput } from '../../backend/utils/account-settings'

beforeAll(() => vi.stubGlobal('createError', createError))

const validInput = {
  profile: {
    displayName: '  Mog  ',
    team: '  Software  '
  },
  settings: {
    idleThresholdMinutes: 5,
    nudgeCadenceMinutes: 50,
    breezyVerbosity: 'gentle',
    muted: false,
    locationEnabled: false,
    activityEnabled: true,
    locationLabels: [' Home office ', 'Home office', 'AirGradient office']
  }
}

describe('combined account settings validation', () => {
  it('normalizes profile text and removes duplicate location labels', () => {
    expect(parseAccountSettingsInput(validInput)).toEqual({
      profile: {
        displayName: 'Mog',
        team: 'Software'
      },
      settings: {
        idleThresholdMinutes: 5,
        nudgeCadenceMinutes: 50,
        breezyVerbosity: 'gentle',
        muted: false,
        locationEnabled: false,
        activityEnabled: true,
        locationLabels: ['Home office', 'AirGradient office']
      }
    })
  })

  it.each([
    [null, 'account settings body must be an object.'],
    [[], 'account settings body must be an object.'],
    [{ settings: validInput.settings }, 'profile must be an object.'],
    [{ profile: validInput.profile }, 'settings must be an object.'],
    [withProfile({ displayName: '' }), 'displayName is required.'],
    [withProfile({ displayName: 'x'.repeat(101) }), 'displayName must be at most 100 characters.'],
    [withProfile({ team: '' }), 'team is required.'],
    [withProfile({ team: 'x'.repeat(81) }), 'team must be at most 80 characters.'],
    [withSettings({ idleThresholdMinutes: 0 }), 'idleThresholdMinutes must be between 1 and 240.'],
    [withSettings({ idleThresholdMinutes: 241 }), 'idleThresholdMinutes must be between 1 and 240.'],
    [withSettings({ locationEnabled: 1 }), 'locationEnabled must be a boolean.'],
    [withSettings({ activityEnabled: null }), 'activityEnabled must be a boolean.'],
    [withSettings({ locationLabels: Array.from({ length: 21 }, (_, index) => `Location ${index}`) }), 'locationLabels must contain at most 20 items.'],
    [withSettings({ locationLabels: ['x'.repeat(101)] }), 'locationLabels[0] must be at most 100 characters.']
  ])('rejects an invalid complete payload', (input, expectedMessage) => {
    expect(() => parseAccountSettingsInput(input)).toThrow(expectedMessage)
  })

  it('ignores client-supplied Breezy fields and returns system-managed defaults', () => {
    expect(parseAccountSettingsInput(withSettings({
      nudgeCadenceMinutes: 1_441,
      breezyVerbosity: 'quiet',
      muted: true
    })).settings).toMatchObject({
      nudgeCadenceMinutes: 50,
      breezyVerbosity: 'gentle',
      muted: false
    })
  })
})

function withProfile(overrides: Record<string, unknown>) {
  return {
    ...validInput,
    profile: { ...validInput.profile, ...overrides }
  }
}

function withSettings(overrides: Record<string, unknown>) {
  return {
    ...validInput,
    settings: { ...validInput.settings, ...overrides }
  }
}
