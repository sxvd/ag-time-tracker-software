import { reactive, ref } from 'vue'
import type { AccountSettingsInput } from '~~/shared/types/account-settings'
import { SYSTEM_BREEZY_SETTINGS } from '~~/shared/constants/account-settings.mjs'
import type { TrackerFetchOptions } from '~/composables/useTrackerApi'
import type { ApiState } from '~/types/api'

const uncertainSaveMessage = 'Could not confirm whether settings were saved. Refresh and check before trying again.'

export interface AccountSettingsDependencies {
  authFetch: (url: string, options?: TrackerFetchOptions) => Promise<unknown>
  loadState: (state: ApiState) => Promise<void> | void
  openSettingsDestination: () => void
}

export function useAccountSettings(dependencies: AccountSettingsDependencies) {
  const isSavingAccountSettings = ref(false)
  const accountSettingsError = ref('')
  const accountSettingsStatus = ref('')
  const settingsForm = reactive<AccountSettingsInput['settings']>({
    idleThresholdMinutes: 5,
    ...SYSTEM_BREEZY_SETTINGS,
    locationEnabled: false,
    activityEnabled: true,
    locationLabels: []
  })

  function clearAccountSettingsFeedback() {
    accountSettingsError.value = ''
    accountSettingsStatus.value = ''
  }

  function openSettings() {
    clearAccountSettingsFeedback()
    dependencies.openSettingsDestination()
  }

  function syncAccountSettings(next: ApiState) {
    Object.assign(settingsForm, next.settings, {
      locationLabels: [...next.settings.locationLabels]
    })
  }

  function stateMatchesAccountSettings(next: ApiState, input: AccountSettingsInput) {
    return next.user.displayName === input.profile.displayName
      && next.user.team === input.profile.team
      && next.settings.idleThresholdMinutes === input.settings.idleThresholdMinutes
      && next.settings.nudgeCadenceMinutes === SYSTEM_BREEZY_SETTINGS.nudgeCadenceMinutes
      && next.settings.breezyVerbosity === SYSTEM_BREEZY_SETTINGS.breezyVerbosity
      && next.settings.muted === SYSTEM_BREEZY_SETTINGS.muted
      && next.settings.locationEnabled === input.settings.locationEnabled
      && next.settings.activityEnabled === input.settings.activityEnabled
      && JSON.stringify(next.settings.locationLabels) === JSON.stringify(input.settings.locationLabels)
  }

  function validationMessage(error: any) {
    const statusCode = Number(error?.statusCode || error?.status || error?.response?.status || 0)
    const message = error?.data?.statusMessage || error?.response?._data?.statusMessage || error?.statusMessage
    return statusCode >= 400 && statusCode < 500 && typeof message === 'string' ? message : ''
  }

  async function saveAccountSettings(input: AccountSettingsInput) {
    if (isSavingAccountSettings.value) return
    clearAccountSettingsFeedback()
    isSavingAccountSettings.value = true

    try {
      const next = await dependencies.authFetch('/api/account-settings', {
        method: 'PATCH',
        body: input
      }) as ApiState
      await dependencies.loadState(next)
      if (stateMatchesAccountSettings(next, input)) {
        accountSettingsStatus.value = 'Settings saved.'
      } else {
        accountSettingsError.value = uncertainSaveMessage
      }
    } catch (error) {
      const message = validationMessage(error)
      if (message) {
        accountSettingsError.value = message
        return
      }

      try {
        const refreshed = await dependencies.authFetch('/api/bootstrap') as ApiState
        await dependencies.loadState(refreshed)
        if (stateMatchesAccountSettings(refreshed, input)) {
          accountSettingsStatus.value = 'Settings saved.'
        } else {
          accountSettingsError.value = uncertainSaveMessage
        }
      } catch {
        accountSettingsError.value = uncertainSaveMessage
      }
    } finally {
      isSavingAccountSettings.value = false
    }
  }

  return {
    accountSettingsError,
    accountSettingsStatus,
    clearAccountSettingsFeedback,
    isSavingAccountSettings,
    openSettings,
    saveAccountSettings,
    settingsForm,
    syncAccountSettings
  }
}
