<script setup lang="ts">
import type { AccountSettingsInput } from '~~/shared/types/account-settings'
import { SYSTEM_BREEZY_SETTINGS } from '~~/shared/constants/account-settings.mjs'
import { DEFAULT_CATEGORY_NAMES } from '~~/shared/constants/categories.mjs'

const props = defineProps<{
  user: { displayName: string, email: string, team: string }
  settings: AccountSettingsInput['settings']
  saving: boolean
  error: string
  status: string
}>()

const emit = defineEmits<{
  save: [input: AccountSettingsInput]
}>()

const teams = DEFAULT_CATEGORY_NAMES
const form = ref<HTMLFormElement | null>(null)
const newLocationLabel = ref('')

const draft = reactive<AccountSettingsInput>({
  profile: { displayName: '', team: '' },
  settings: {
    idleThresholdMinutes: 5,
    ...SYSTEM_BREEZY_SETTINGS,
    locationEnabled: false,
    activityEnabled: true,
    locationLabels: []
  }
})

const baseline = ref('')

function snapshotFromProps(): AccountSettingsInput {
  return {
    profile: {
      displayName: props.user.displayName,
      team: props.user.team
    },
    settings: {
      idleThresholdMinutes: props.settings.idleThresholdMinutes,
      ...SYSTEM_BREEZY_SETTINGS,
      locationEnabled: props.settings.locationEnabled,
      activityEnabled: props.settings.activityEnabled,
      locationLabels: [...props.settings.locationLabels]
    }
  }
}

function normalizedDraft(): AccountSettingsInput {
  return {
    profile: {
      displayName: draft.profile.displayName.trim(),
      team: draft.profile.team.trim()
    },
    settings: {
      idleThresholdMinutes: Number(draft.settings.idleThresholdMinutes),
      ...SYSTEM_BREEZY_SETTINGS,
      locationEnabled: draft.settings.locationEnabled,
      activityEnabled: draft.settings.activityEnabled,
      locationLabels: draft.settings.locationLabels.map(label => label.trim())
    }
  }
}

function replaceDraft(next: AccountSettingsInput) {
  draft.profile.displayName = next.profile.displayName
  draft.profile.team = next.profile.team
  Object.assign(draft.settings, next.settings, { locationLabels: [...next.settings.locationLabels] })
  baseline.value = JSON.stringify(next)
  newLocationLabel.value = ''
}

replaceDraft(snapshotFromProps())

watch(
  () => snapshotFromProps(),
  (next) => {
    if (JSON.stringify(next) !== baseline.value) replaceDraft(next)
  },
  { deep: true }
)

function integerError(value: unknown, label: string, min: number, max: number) {
  const number = Number(value)
  if (!Number.isInteger(number)) return `${label} must be a whole number.`
  if (number < min || number > max) {
    return `${label} must be from ${min.toLocaleString()} to ${max.toLocaleString()} minutes.`
  }
  return ''
}

const errors = computed(() => {
  const displayName = draft.profile.displayName.trim()
  const labels = draft.settings.locationLabels.map(label => label.trim())
  const duplicateLabels = new Set(labels).size !== labels.length

  return {
    displayName: !displayName
      ? 'Display name is required.'
      : displayName.length > 100
        ? 'Display name must be 100 characters or fewer.'
        : '',
    team: !teams.includes(draft.profile.team as typeof teams[number])
      ? 'Choose a valid team.'
      : '',
    idleThreshold: integerError(draft.settings.idleThresholdMinutes, 'Ask me after no activity for', 1, 240),
    activityEnabled: typeof draft.settings.activityEnabled !== 'boolean' ? 'Activity tracking must be on or off.' : '',
    locationEnabled: typeof draft.settings.locationEnabled !== 'boolean' ? 'Location labels must be on or off.' : '',
    locationLabels: labels.length > 20
      ? 'You can save up to 20 location labels.'
      : labels.some(label => !label)
        ? 'Location labels cannot be empty.'
        : labels.some(label => label.length > 100)
          ? 'Location labels must be 100 characters or fewer.'
          : duplicateLabels
            ? 'Location labels must be unique.'
            : ''
  }
})

const isValid = computed(() => Object.values(errors.value).every(error => !error))
const isDirty = computed(() => JSON.stringify(normalizedDraft()) !== baseline.value)
const saveDisabled = computed(() => props.saving || !isValid.value || !isDirty.value)

const newLocationLabelError = computed(() => {
  const label = newLocationLabel.value.trim()
  if (draft.settings.locationLabels.length >= 20) return 'You can save up to 20 location labels.'
  if (!label) return ''
  if (label.length > 100) return 'Location labels must be 100 characters or fewer.'
  if (draft.settings.locationLabels.some(existing => existing.trim() === label)) {
    return 'Location labels must be unique.'
  }
  return ''
})

const addLocationDisabled = computed(() => (
  !props.settings
  || !newLocationLabel.value.trim()
  || Boolean(newLocationLabelError.value)
))

function addLocationLabel() {
  if (addLocationDisabled.value) return
  draft.settings.locationLabels.push(newLocationLabel.value.trim())
  newLocationLabel.value = ''
}

function removeLocationLabel(index: number) {
  draft.settings.locationLabels.splice(index, 1)
}

function submit() {
  if (!isValid.value) {
    nextTick(() => form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
    return
  }
  if (saveDisabled.value) return
  emit('save', normalizedDraft())
}
</script>

<template>
  <form ref="form" class="settings-page" novalidate @submit.prevent="submit">
    <div class="settings-layout">
      <section class="card pad settings-card settings-profile-card">
        <h2>Profile</h2>
        <p class="muted">Your display name and team. Team uses the same list as task categories.</p>
        <div class="settings-profile-grid">
          <div>
            <label for="settings-display-name">
              Display name
              <input
                id="settings-display-name"
                v-model="draft.profile.displayName"
                data-testid="display-name"
                maxlength="101"
                :aria-invalid="Boolean(errors.displayName)"
                aria-describedby="display-name-error"
                autocomplete="name"
              >
            </label>
            <p v-if="errors.displayName" id="display-name-error" class="field-error">{{ errors.displayName }}</p>
          </div>

          <div>
            <label for="settings-team">
              Team
              <select id="settings-team" v-model="draft.profile.team" data-testid="team" :aria-invalid="Boolean(errors.team)">
                <option v-for="team in teams" :key="team" :value="team">{{ team }}</option>
              </select>
            </label>
            <p v-if="errors.team" class="field-error">{{ errors.team }}</p>
          </div>
        </div>
      </section>

      <section class="card pad settings-card settings-card-wide">
        <h2>Activity &amp; Privacy</h2>
        <label class="settings-toggle" for="settings-activity-enabled">
          <span>
            <strong>Track activity signals</strong>
            <small>While your timer is running, the app can notice no-activity time and count tab switches.</small>
          </span>
          <input id="settings-activity-enabled" v-model="draft.settings.activityEnabled" data-testid="activity-enabled" type="checkbox">
        </label>

        <label for="settings-idle-threshold">
          Ask me after no activity for
          <span class="settings-number-row">
            <input
              id="settings-idle-threshold"
              v-model="draft.settings.idleThresholdMinutes"
              data-testid="idle-threshold"
              type="number"
              min="1"
              max="240"
              step="1"
              :disabled="!draft.settings.activityEnabled"
              :aria-invalid="Boolean(errors.idleThreshold)"
            >
            <span>minutes</span>
          </span>
        </label>
        <p v-if="errors.idleThreshold" class="field-error">{{ errors.idleThreshold }}</p>
        <p class="privacy-note">Privacy guardrail: context switches save counts only. The app does not save URLs, app names, page titles, screenshots, or keystrokes.</p>

        <label class="settings-toggle" for="settings-location-enabled">
          <span>
            <strong>Use location labels on entries</strong>
            <small>Optional labels such as Home office or AirGradient office. You can edit the label list below anytime.</small>
          </span>
          <input id="settings-location-enabled" v-model="draft.settings.locationEnabled" data-testid="location-enabled" type="checkbox">
        </label>

        <div class="location-label-editor">
          <label for="settings-location-label">Manage location labels</label>
          <div class="location-label-row">
            <input
              id="settings-location-label"
              v-model="newLocationLabel"
              data-testid="location-label"
              maxlength="101"
              :aria-invalid="Boolean(newLocationLabelError)"
              placeholder="Add a label, e.g. Home office"
              @keydown.enter.prevent="addLocationLabel"
            >
            <button
              type="button"
              class="btn ghost"
              data-testid="add-location-label"
              :disabled="addLocationDisabled"
              @click="addLocationLabel"
            >
              Add
            </button>
          </div>
          <p v-if="newLocationLabelError" class="field-error">{{ newLocationLabelError }}</p>
          <p v-else-if="errors.locationLabels" class="field-error">{{ errors.locationLabels }}</p>
          <div v-if="draft.settings.locationLabels.length" class="location-label-list">
            <span v-for="(label, index) in draft.settings.locationLabels" :key="`${label}-${index}`" class="location-label-chip">
              {{ label }}
              <button
                type="button"
                :aria-label="`Remove ${label}`"
                @click="removeLocationLabel(index)"
              >×</button>
            </span>
          </div>
        </div>
      </section>
    </div>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p v-if="status" class="form-status" role="status" aria-live="polite">{{ status }}</p>

    <div class="settings-save-row">
      <button type="submit" class="btn primary" :disabled="saveDisabled">
        {{ saving ? 'Saving...' : 'Save changes' }}
      </button>
    </div>
  </form>
</template>
