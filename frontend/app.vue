<script setup lang="ts">
import AccountMenu from '~/features/settings/AccountMenu.vue'
import { useAppNavigation } from '~/composables/useAppNavigation'
import { saveExportBlob, useTrackerApi } from '~/composables/useTrackerApi'
import SignInPanel from '~/features/auth/SignInPanel.vue'
import { useSession } from '~/features/auth/useSession'
import CompanyDashboard from '~/features/dashboard/CompanyDashboard.vue'
import EntryHistory from '~/features/dashboard/EntryHistory.vue'
import PersonalDashboard from '~/features/dashboard/PersonalDashboard.vue'
import BreezyCompanion from '~/features/breezy/BreezyCompanion.vue'
import BreezyNudgeToast from '~/features/breezy/BreezyNudgeToast.vue'
import { useBreezyRuntime } from '~/features/breezy/useBreezyRuntime'
import { useBreezyNudges } from '~/features/breezy/useBreezyNudges'
import BreezyJourney from '~/features/breezy/BreezyJourney.vue'
import EntryEditModal from '~/features/feedback/EntryEditModal.vue'
import FeedbackModal from '~/features/feedback/FeedbackModal.vue'
import ManualEntryModal from '~/features/feedback/ManualEntryModal.vue'
import { useEntries } from '~/features/feedback/useEntries'
import SettingsPage from '~/features/settings/SettingsPage.vue'
import { useAccountSettings } from '~/features/settings/useAccountSettings'
import CreateTaskModal from '~/features/tasks/CreateTaskModal.vue'
import ShareTaskModal from '~/features/tasks/ShareTaskModal.vue'
import { useTasks } from '~/features/tasks/useTasks'
import IdleDecisionModal from '~/features/tracking/IdleDecisionModal.vue'
import TimerPanel from '~/features/tracking/TimerPanel.vue'
import { useIdleActivity } from '~/features/tracking/useIdleActivity'
import { useTimerSession } from '~/features/tracking/useTimerSession'
import type { ApiCompanyDashboard, ApiState } from '~/types/api'
import { withAppBase } from '~~/shared/utils/url'

type EntryScope = 'Individual' | 'Team'

const state = ref<ApiState | null>(null)
const entryScope = ref<EntryScope>('Individual')
const theme = useTheme()
const brandLogoUrl = withAppBase(useRuntimeConfig().app.baseURL, '/airgradient-logo.svg')
const { authFetch, fetchExport, saveTabSessionToken } = useTrackerApi()
const exportError = ref('')
const companyDashboard = ref<ApiCompanyDashboard | null>(null)
const companyCategoryId = ref('')
const companyWeekStart = ref('')
const companyMetric = ref<ApiCompanyDashboard['overview']['metric']>('trackedTime')
const companyGroupBy = ref<ApiCompanyDashboard['overview']['groupBy']>('category')
const companyChartType = ref<'bar' | 'line'>('bar')
const isRefreshingCompany = ref(false)
const companyRefreshError = ref('')
const timerPanel = ref<{ focusTaskInput: () => void } | null>(null)
let waitForContextSwitches: () => Promise<void> = () => Promise.resolve()
let navigateToSettings: () => void = () => undefined
let isUnmounted = false

const currentUserId = computed(() => state.value?.user.id || 'u1')
const activeEntry = computed(() => state.value?.entries.find((entry) => entry.userId === currentUserId.value && !entry.endedAt) || null)
const {
  accountSettingsError,
  accountSettingsStatus,
  clearAccountSettingsFeedback,
  isSavingAccountSettings,
  openSettings,
  saveAccountSettings,
  settingsForm,
  syncAccountSettings
} = useAccountSettings({
  authFetch,
  loadState,
  openSettingsDestination: () => navigateToSettings()
})
const breezyRuntime = useBreezyRuntime({
  verbosity: () => settingsForm.breezyVerbosity,
  muted: () => settingsForm.muted
})
const {
  acceptInvitation,
  activeTask,
  categoryName,
  createTask,
  currentCategoryName,
  currentTask,
  ensureInlineTask,
  handleTaskDraftChange,
  hasInlineTaskTitle,
  inlineCategoryId,
  inlineTaskTitle,
  invitationForRecipient,
  resetInlineTaskDraft,
  selectInlineCategory,
  selectTeamTask,
  selectedShareUserIds,
  selectedTaskId,
  shareButtonLabel,
  shareCurrentTask,
  sharePickerOpen,
  shareableTask,
  shareableUsers,
  sharedTasksForCurrentUser,
  showCreateTask,
  showShareTaskModal,
  syncTasks,
  taskForm,
  teamTasksForCurrentUser,
  taskName,
  userName
} = useTasks({
  state,
  currentUserId,
  activeEntry,
  authFetch,
  loadState,
  onBreezyEvent: breezyRuntime.publish
})
const {
  addManualEntry,
  editingEntry,
  editEntryError,
  feedbackError,
  isSavingEntryEdit,
  isSavingFeedback,
  manualForm,
  openEntryEditor,
  saveEntryEdit,
  saveFeedback,
  showFeedback,
  showManualEntry,
  stopTimer,
  syncEntries
} = useEntries({
  activeEntry,
  currentUserId,
  selectedTaskId,
  authFetch,
  loadState,
  waitForContextSwitches: () => waitForContextSwitches(),
  resetInlineTaskDraft,
  onBreezyEvent: breezyRuntime.publish
})
const {
  activePageKey,
  activeSection,
  audienceMode,
  heroTitle,
  openCompanyDashboard,
  openJourney,
  openPersonalDashboard,
  openSettings: openSettingsDestination,
  openTrack,
  pageEyebrow,
  pageSubtitle
} = useAppNavigation({
  activeTaskTitle: computed(() => currentTask.value?.title),
  hasActiveEntry: computed(() => Boolean(activeEntry.value))
})
navigateToSettings = openSettingsDestination
const {
  disposeTimer,
  elapsedSeconds,
  handlePrimaryTimerAction,
  isUpdatingPause,
  pausedAt,
  primaryTimerLabel,
  syncTimerSession,
  timerActionError
} = useTimerSession({
  activeEntry,
  ensureInlineTask,
  hasInlineTaskTitle,
  focusTaskInput: () => timerPanel.value?.focusTaskInput(),
  authFetch,
  loadState,
  onBreezyEvent: breezyRuntime.publish,
  onSessionStarted: () => idleActivity.resetForStartedSession(),
  onSessionResumed: () => idleActivity.resetAfterResume()
})
const idleActivity = useIdleActivity({
  state,
  activeEntry,
  pausedAt,
  showFeedback,
  settings: settingsForm,
  authFetch,
  loadState,
  onBreezyEvent: breezyRuntime.publish
})
const {
  contextSwitches,
  disposeActivityListeners,
  idleDecisionError,
  idlePrompt,
  idleSeconds,
  isSavingIdleDecision,
  saveIdleDecision,
  startActivityListeners,
  syncIdleActivity
} = idleActivity
waitForContextSwitches = idleActivity.waitForContextSwitches
const breezyNudgeSuppressed = computed(() => Boolean(
  showFeedback.value
  || idlePrompt.value
  || showManualEntry.value
  || editingEntry.value
  || showCreateTask.value
  || showShareTaskModal.value
  || isSavingAccountSettings.value
))
const {
  activeNudge,
  activeNudgeIsRestored,
  dismissNudgeError,
  dismissActiveNudge,
  disposeNudgeScheduler,
  isDismissingNudge,
  syncNudgeScheduler
} = useBreezyNudges({
  activeEntry,
  pausedAt,
  settings: settingsForm,
  suppressed: breezyNudgeSuppressed,
  restoredNudges: computed(() => state.value?.breezyNudges || []),
  authFetch,
  publish: breezyRuntime.publish
})
const {
  isAuthenticated,
  isRestoringSession,
  logout,
  openSignIn,
  restoreSession,
  showSignIn,
  signInError,
  submitSignIn
} = useSession({
  authFetch,
  saveTabSessionToken,
  onAuthenticated: async (next) => {
    await loadState(next)
  },
  onLogout: () => {
    state.value = null
    companyDashboard.value = null
    companyCategoryId.value = ''
    companyWeekStart.value = ''
    syncTimerSession()
    selectedTaskId.value = ''
    elapsedSeconds.value = 0
    clearAccountSettingsFeedback()
    activeSection.value = 'Track'
    audienceMode.value = 'You'
    breezyRuntime.restore({ active: false, paused: false })
  }
})
const personal = computed(() => state.value!.dashboards.personal)
const ownEntries = computed(() => state.value?.entries.filter((entry) => entry.userId === currentUserId.value && entry.endedAt) || [])
const teamEntries = computed(() => state.value?.entries.filter((entry) => entry.endedAt) || [])
const todayEntries = computed(() => (entryScope.value === 'Individual' ? ownEntries.value : teamEntries.value))
const initials = computed(() => (state.value?.user.displayName || 'AG').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase())
onMounted(async () => {
  await restoreSession()
  if (isUnmounted) return
  startActivityListeners()
})

onBeforeUnmount(() => {
  isUnmounted = true
  disposeTimer()
  theme.dispose()
  disposeActivityListeners()
  disposeNudgeScheduler()
})

watch(
  () => [activeEntry.value?.id, pausedAt.value, settingsForm.muted, settingsForm.breezyVerbosity, breezyNudgeSuppressed.value],
  syncNudgeScheduler,
  { flush: 'post' }
)

watch(
  () => [activeSection.value, audienceMode.value],
  ([section, audience]) => {
    if (section === 'Dashboard' && audience === 'Company' && !companyDashboard.value && !isRefreshingCompany.value) {
      void refreshCompany()
    }
  }
)

async function loadState(next?: ApiState) {
  if (isUnmounted) return
  const resolved = next || await authFetch<ApiState>('/api/bootstrap')
  if (isUnmounted) return
  state.value = resolved
  syncTasks(state.value)
  syncEntries()
  syncAccountSettings(state.value)
  syncTimerSession()
  syncIdleActivity()
  breezyRuntime.restore({
    active: Boolean(activeEntry.value),
    paused: Boolean(pausedAt.value),
    latestJourneyMood: state.value.journey.at(-1)?.mood
  })
  syncNudgeScheduler()
}

async function refreshCompany() {
  companyRefreshError.value = ''
  isRefreshingCompany.value = true
  try {
    const query = new URLSearchParams({
      metric: companyMetric.value,
      groupBy: companyGroupBy.value
    })
    if (companyCategoryId.value) query.set('categoryId', companyCategoryId.value)
    if (companyWeekStart.value) query.set('weekStart', companyWeekStart.value)
    applyCompanyDashboard(await authFetch<ApiCompanyDashboard>(`/api/company-dashboard?${query.toString()}`))
  } catch (error) {
    if (companyCategoryId.value && isUnknownCompanyCategory(error)) {
      companyCategoryId.value = ''
      try {
        const fallbackQuery = new URLSearchParams({
          metric: companyMetric.value,
          groupBy: companyGroupBy.value
        })
        if (companyWeekStart.value) fallbackQuery.set('weekStart', companyWeekStart.value)
        applyCompanyDashboard(await authFetch<ApiCompanyDashboard>(`/api/company-dashboard?${fallbackQuery.toString()}`))
        companyRefreshError.value = 'The selected category is no longer available. Showing all categories instead.'
        return
      } catch {
        // Keep the prior aggregate visible when the fallback refresh also fails.
      }
    }
    companyRefreshError.value = 'Could not refresh company data. Previous results are still shown.'
  } finally {
    isRefreshingCompany.value = false
  }
}

function applyCompanyDashboard(next: ApiCompanyDashboard) {
  companyDashboard.value = next
  companyCategoryId.value = next.categoryId || ''
  companyWeekStart.value = next.week.start
}

function isUnknownCompanyCategory(error: unknown) {
  const candidate = error as { statusCode?: number, status?: number, message?: string, statusMessage?: string }
  const status = Number(candidate?.statusCode || candidate?.status || 0)
  const message = `${candidate?.statusMessage || ''} ${candidate?.message || ''}`
  return status === 400 && /available category/i.test(message)
}

async function downloadExport(format: 'csv' | 'json') {
  exportError.value = ''
  try {
    saveExportBlob(await fetchExport(format), format)
  } catch {
    exportError.value = 'Could not download your raw data. Please try again.'
  }
}

async function handleDismissBreezyNudge() {
  const dismissedId = await dismissActiveNudge()
  if (!dismissedId) return
  breezyRuntime.dismissNudge(dismissedId, {
    active: Boolean(activeEntry.value),
    paused: Boolean(pausedAt.value),
    latestJourneyMood: state.value?.journey.at(-1)?.mood
  })
}

</script>

<template>
  <SignInPanel
    v-if="isRestoringSession || !isAuthenticated"
    :restoring="isRestoringSession"
    :show-form="showSignIn"
    :error="signInError"
    @open="openSignIn"
    @submit="submitSignIn"
  />

  <main v-else-if="state" class="app-shell">
    <aside class="sidebar" aria-label="Workspace navigation">
      <div class="brand">
        <img class="brand-logo" :src="brandLogoUrl" alt="AirGradient">
        <span class="brand-product-name">Time Tracker</span>
      </div>

      <nav class="nav-group" aria-label="Main sections">
        <p class="nav-label">Workspace</p>
        <button type="button" class="nav-item" :class="{ active: activePageKey === 'track' }" @click="openTrack">
          <span class="ico" aria-hidden="true">T</span>
          Track
          <span v-if="activeEntry" class="badge">Live</span>
        </button>
        <button type="button" class="nav-item" :class="{ active: activePageKey === 'personal' }" @click="openPersonalDashboard">
          <span class="ico" aria-hidden="true">P</span>
          Personal dashboard
        </button>
        <button type="button" class="nav-item" :class="{ active: activePageKey === 'company' }" @click="openCompanyDashboard">
          <span class="ico" aria-hidden="true">C</span>
          Company dashboard
        </button>
        <button type="button" class="nav-item" :class="{ active: activePageKey === 'journey' }" @click="openJourney">
          <span class="ico" aria-hidden="true">J</span>
          Work Journey
        </button>
      </nav>

      <div class="nav-spacer"></div>

      <AccountMenu
        :user="state.user"
        :initials="initials"
        :theme-preference="theme.preference.value"
        @open-settings="openSettings"
        @theme-change="theme.setPreference"
        @logout="logout"
      />
    </aside>

    <section class="main">
      <div class="main-inner">
        <header class="topbar">
          <div class="topbar-l">
            <p class="eyebrow">{{ pageEyebrow }}</p>
            <h1 class="page-title">{{ heroTitle }}</h1>
            <p class="page-sub">{{ pageSubtitle }}</p>
          </div>
          <div class="topbar-r">
            <span class="priv" :class="audienceMode === 'You' ? 'you' : 'co'">
              {{ audienceMode === 'You' ? 'Private detail' : 'Aggregated only' }}
            </span>
            <button v-if="activeSection === 'Track'" type="button" class="btn soft" @click="showManualEntry = true">Manual entry</button>
            <button
              v-if="activeSection === 'Dashboard' && audienceMode === 'You'"
              type="button"
              class="btn primary"
              @click="downloadExport('csv')"
            >Export CSV</button>
            <button v-else-if="activeSection === 'Track'" type="button" class="btn primary" @click="showCreateTask = true">New team task</button>
            <span v-if="activeSection === 'Dashboard' && audienceMode === 'You' && exportError" class="form-error" role="alert">{{ exportError }}</span>
          </div>
        </header>

        <template v-if="activeSection === 'Track'">
          <section class="track-grid">
            <div class="tracking-workspace">
              <TimerPanel
                ref="timerPanel"
                v-model:inline-task-title="inlineTaskTitle"
                :active-entry="activeEntry"
                :active-task-title="activeTask?.title || ''"
                :categories="state.categories"
                :category-name="categoryName"
                :context-switches="contextSwitches"
                :current-category-name="currentCategoryName"
                :elapsed-seconds="elapsedSeconds"
                :has-inline-task-title="hasInlineTaskTitle"
                :idle-seconds="idleSeconds"
                :inline-category-id="inlineCategoryId"
                :is-updating-pause="isUpdatingPause"
                :timer-action-error="timerActionError"
                :paused-at="pausedAt"
                :primary-timer-label="primaryTimerLabel"
                :shareable-task="shareableTask"
                :shared-tasks="sharedTasksForCurrentUser"
                :user-name="userName"
                @draft-change="handleTaskDraftChange"
                @select-category="selectInlineCategory"
                @open-share="showShareTaskModal = true"
                @accept-invitation="acceptInvitation"
                @primary-action="handlePrimaryTimerAction"
                @stop="stopTimer"
              />

              <BreezyCompanion
                :presentation="breezyRuntime.presentation.value"
                :motion-key="breezyRuntime.motionKey.value"
                :muted="settingsForm.muted"
              />
            </div>
            <BreezyNudgeToast
              v-if="activeNudge && activeEntry && !pausedAt && !breezyNudgeSuppressed && !settingsForm.muted && settingsForm.breezyVerbosity !== 'quiet'"
              :nudge="activeNudge"
              :restored="activeNudgeIsRestored"
              :dismissing="isDismissingNudge"
              :error="dismissNudgeError"
              @dismiss="handleDismissBreezyNudge"
            />

            <EntryHistory
              v-model:scope="entryScope"
              :entries="todayEntries"
              :team-tasks="teamTasksForCurrentUser"
              :selected-task-id="selectedTaskId"
              :has-active-entry="Boolean(activeEntry)"
              :current-user-id="currentUserId"
              :task-name="taskName"
              :user-name="userName"
              @clear-team-task="resetInlineTaskDraft"
              @edit="openEntryEditor"
              @select-team-task="selectTeamTask"
            />
          </section>
        </template>

        <SettingsPage
          v-else-if="activeSection === 'Settings'"
          :user="state.user"
          :settings="state.settings"
          :saving="isSavingAccountSettings"
          :error="accountSettingsError"
          :status="accountSettingsStatus"
          @save="saveAccountSettings"
        />

        <PersonalDashboard
          v-else-if="activeSection === 'Dashboard' && audienceMode === 'You'"
          :dashboard="personal"
          :medals="state.medals"
        />

        <CompanyDashboard
          v-else-if="activeSection === 'Dashboard' && audienceMode === 'Company'"
          v-model:category-id="companyCategoryId"
          v-model:metric="companyMetric"
          v-model:group-by="companyGroupBy"
          v-model:chart-type="companyChartType"
          v-model:week-start="companyWeekStart"
          :dashboard="companyDashboard"
          :loading="isRefreshingCompany"
          :error="companyRefreshError"
          @refresh="refreshCompany"
        />

        <BreezyJourney
          v-else
          :journey="state.journey"
          :entries="state.entries"
          :tasks="state.tasks"
          :categories="state.categories"
        />
      </div>

      <IdleDecisionModal
        v-if="idlePrompt"
        :idle-seconds="idlePrompt.idleSeconds"
        :error="idleDecisionError"
        :saving="isSavingIdleDecision"
        @select="saveIdleDecision"
      />
      <FeedbackModal v-if="showFeedback" :error="feedbackError" :saving="isSavingFeedback" @save="saveFeedback" @skip="saveFeedback()" />
      <EntryEditModal
        v-if="editingEntry"
        :entry="editingEntry"
        :tasks="state.tasks"
        :blocker-options="state.blockers"
        :saving="isSavingEntryEdit"
        :error="editEntryError"
        @cancel="editingEntry = null"
        @save="saveEntryEdit"
      />
      <ShareTaskModal
        v-if="showShareTaskModal && shareableTask"
        v-model:selected-user-ids="selectedShareUserIds"
        :task="shareableTask"
        :users="shareableUsers"
        :invitation-for-recipient="invitationForRecipient"
        @close="showShareTaskModal = false"
        @share="shareCurrentTask"
      />
      <CreateTaskModal
        v-if="showCreateTask"
        v-model:form="taskForm"
        v-model:picker-open="sharePickerOpen"
        v-model:selected-user-ids="selectedShareUserIds"
        :categories="state.categories"
        :users="shareableUsers"
        :share-button-label="shareButtonLabel()"
        @close="showCreateTask = false"
        @submit="createTask"
      />

      <ManualEntryModal
        v-if="showManualEntry"
        v-model:form="manualForm"
        :tasks="state.tasks"
        @close="showManualEntry = false"
        @submit="addManualEntry"
      />
    </section>
  </main>
</template>
