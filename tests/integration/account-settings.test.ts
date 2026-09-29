import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { updateAccountSettings } from '../../backend/utils/store'
import type { AccountSettingsInput } from '../../shared/types/account-settings'
import {
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

const input: AccountSettingsInput = {
  profile: { displayName: 'After', team: 'Hardware' },
  settings: {
    idleThresholdMinutes: 12,
    nudgeCadenceMinutes: 60,
    breezyVerbosity: 'quiet',
    muted: true,
    locationEnabled: false,
    activityEnabled: false,
    locationLabels: ['AirGradient office']
  }
}

describe('atomic account settings persistence', () => {
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('updates the profile and creates a missing settings row together', async () => {
    const user = await createUser({
      id: 'settings-user',
      email: 'settings@airgradient.com',
      displayName: 'Before'
    })

    await updateAccountSettings(user.id, input)

    expect(await integrationPrisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .toMatchObject({ displayName: 'After', team: 'Hardware' })
    expect(await integrationPrisma.settings.findUniqueOrThrow({ where: { userId: user.id } }))
      .toMatchObject({
        idleThresholdMinutes: 12,
        nudgeCadenceMinutes: 50,
        breezyVerbosity: 'gentle',
        muted: false,
        activityEnabled: false,
        locationLabels: ['AirGradient office']
      })
  })

  it('does not modify another user', async () => {
    const owner = await createUser({ id: 'owner', email: 'owner@airgradient.com', displayName: 'Owner' })
    const other = await createUser({ id: 'other', email: 'other@airgradient.com', displayName: 'Other' })

    await updateAccountSettings(owner.id, input)

    expect(await integrationPrisma.user.findUniqueOrThrow({ where: { id: other.id } }))
      .toMatchObject({ displayName: 'Other', team: 'Software' })
    expect(await integrationPrisma.settings.findUnique({ where: { userId: other.id } })).toBeNull()
  })

  it('rolls back the profile when the settings write fails', async () => {
    const user = await createUser({
      id: 'rollback-user',
      email: 'rollback@airgradient.com',
      displayName: 'Before'
    })

    await expect(updateAccountSettings(user.id, {
      ...input,
      settings: { ...input.settings, idleThresholdMinutes: 3_000_000_000 }
    })).rejects.toBeTruthy()

    expect(await integrationPrisma.user.findUniqueOrThrow({ where: { id: user.id } }))
      .toMatchObject({ displayName: 'Before', team: 'Software' })
    expect(await integrationPrisma.settings.findUnique({ where: { userId: user.id } })).toBeNull()
  })
})
