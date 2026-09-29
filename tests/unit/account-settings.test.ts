import { describe, expect, it, vi } from 'vitest'
import type { AccountSettingsInput } from '../../shared/types/account-settings'
import type { ApiState } from '../../frontend/types/api'
import { useAccountSettings } from '../../frontend/features/settings/useAccountSettings'

const input: AccountSettingsInput = {
  profile: { displayName: 'Mog Updated', team: 'Software' },
  settings: {
    idleThresholdMinutes: 10,
    nudgeCadenceMinutes: 50,
    breezyVerbosity: 'gentle',
    muted: false,
    locationEnabled: true,
    activityEnabled: true,
    locationLabels: ['Home office', 'Bangkok office']
  }
}

describe('account settings orchestration', () => {
  it('syncs runtime settings without sharing the API location-label array', () => {
    const state = apiState()
    const account = createAccountSettings()

    account.syncAccountSettings(state)
    state.settings.locationLabels.push('Mutated later')

    expect({ ...account.settingsForm }).toEqual(input.settings)
  })

  it('saves one atomic payload and publishes confirmed success', async () => {
    const updated = apiState()
    const authFetch = vi.fn(async () => updated)
    const loadState = vi.fn(async () => undefined)
    const account = createAccountSettings({ authFetch, loadState })

    await account.saveAccountSettings(input)

    expect(authFetch).toHaveBeenCalledWith('/api/account-settings', {
      method: 'PATCH',
      body: input
    })
    expect(loadState).toHaveBeenCalledWith(updated)
    expect(account.accountSettingsStatus.value).toBe('Settings saved.')
    expect(account.accountSettingsError.value).toBe('')
    expect(account.isSavingAccountSettings.value).toBe(false)
  })

  it('preserves an authoritative validation message without reconciling', async () => {
    const authFetch = vi.fn(async () => {
      throw { statusCode: 400, data: { statusMessage: 'Display name is required.' } }
    })
    const loadState = vi.fn(async () => undefined)
    const account = createAccountSettings({ authFetch, loadState })

    await account.saveAccountSettings(input)

    expect(authFetch).toHaveBeenCalledOnce()
    expect(loadState).not.toHaveBeenCalled()
    expect(account.accountSettingsError.value).toBe('Display name is required.')
    expect(account.accountSettingsStatus.value).toBe('')
  })

  it('reconciles an uncertain response through bootstrap without retrying the mutation', async () => {
    const updated = apiState()
    const authFetch = vi.fn(async (url: string) => {
      if (url === '/api/account-settings') throw new Error('connection closed')
      if (url === '/api/bootstrap') return updated
      throw new Error(`Unexpected request: ${url}`)
    })
    const loadState = vi.fn(async () => undefined)
    const account = createAccountSettings({ authFetch, loadState })

    await account.saveAccountSettings(input)

    expect(authFetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/account-settings',
      '/api/bootstrap'
    ])
    expect(loadState).toHaveBeenCalledOnce()
    expect(loadState).toHaveBeenCalledWith(updated)
    expect(account.accountSettingsStatus.value).toBe('Settings saved.')
  })
})

function createAccountSettings(overrides: Record<string, unknown> = {}) {
  return useAccountSettings({
    authFetch: async () => apiState(),
    loadState: async () => undefined,
    openSettingsDestination: () => undefined,
    ...overrides
  })
}

function apiState(): ApiState {
  return {
    user: {
      id: 'u1',
      email: 'mog@airgradient.com',
      displayName: input.profile.displayName,
      team: input.profile.team
    },
    users: [],
    signedInUsers: [],
    taskInvitations: [],
    categories: [],
    clients: [],
    projects: [],
    blockers: [],
    tasks: [],
    entries: [],
    sharedTaskEffort: [],
    breezyNudges: [],
    settings: {
      ...input.settings,
      locationLabels: [...input.settings.locationLabels]
    },
    dashboards: {
      personal: {
        totalHours: 0,
        totalSeconds: 0,
        byCategory: [],
        byTask: [],
        blockers: [],
        flow: [],
        efficiency: [],
        energy: [],
        trend: [],
      }
    },
    journey: [],
    medals: []
  }
}
