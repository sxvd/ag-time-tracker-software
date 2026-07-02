<script setup lang="ts">
import type { EfficiencyFeel, EnergyLevel, FlowQuality, PauseWindow } from '~~/shared/utils/time'
import { countContextSwitches, secondsBetween } from '~~/shared/utils/time'

type AudienceMode = 'You' | 'Company'
type AppSection = 'Track' | 'Dashboard' | 'Breezy Journey'
type EntryScope = 'Individual' | 'Team'
type ThemeMode = 'light' | 'dark'

interface ApiState {
  user: { id: string, email: string, displayName: string, team: string }
  sessionToken?: string
  users: { id: string, email: string, displayName: string, team: string }[]
  signedInUsers: { id: string, email: string, displayName: string, team: string }[]
  taskInvitations: Array<{ id: string, taskId: string, senderId: string, recipientId: string, status: 'pending' | 'accepted', createdAt: string, respondedAt?: string }>
  categories: { id: string, name: string }[]
  clients: { id: string, name: string }[]
  projects: { id: string, name: string, clientId: string }[]
  blockers: string[]
  tasks: Array<{ id: string, title: string, description: string, categoryId: string, clientId?: string, projectId?: string, estimateMinutes?: number, ownerId: string, isShared: boolean, isArchived: boolean, createdAt: string, members: string[] }>
  entries: Array<{
    id: string
    taskId: string
    userId: string
    startedAt: string
    endedAt: string | null
    durationSeconds: number
    isManual: boolean
    idleSeconds: number
    contextSwitches: number
    locationLabel: string
    pauses: PauseWindow[]
    feedback?: { flowQuality: FlowQuality, efficiencyFeel: EfficiencyFeel, energy: EnergyLevel, note: string }
    blockers: string[]
  }>
  settings: Record<string, any>
  dashboards: any
  journey: Array<{ date: string, mood: string, airClarityScore: number, hours: number, weekLabel: string }>
  medals: Array<{ code: string, name: string, description: string, awarded: boolean }>
}

const state = ref<ApiState | null>(null)
const selectedTaskId = ref('')
const audienceMode = ref<AudienceMode>('You')
const activeSection = ref<AppSection>('Track')
const entryScope = ref<EntryScope>('Individual')
const themeMode = ref<ThemeMode>('light')
const elapsedSeconds = ref(0)
const timerId = ref<ReturnType<typeof setInterval> | null>(null)
const pausedAt = ref<string | null>(null)
const pauses = ref<PauseWindow[]>([])
const contextSwitches = ref(0)
const idleSeconds = ref(0)
const showFeedback = ref(false)
const lastStoppedEntry = ref<string | null>(null)
const feedbackError = ref('')
const isSavingFeedback = ref(false)
const breezyMessage = ref('Start your first task. Breezy is ready when you are.')
const teamFilter = ref('All')
const insight = ref('')
const isAuthenticated = ref(false)
const isRestoringSession = ref(true)
const showSignIn = ref(false)
const signInError = ref('')
const signIn = reactive({ email: '', password: '' })
const showCreateTask = ref(false)
const showManualEntry = ref(false)
const showShareTaskModal = ref(false)
const sharePickerOpen = ref(false)
const selectedShareUserIds = ref<string[]>([])
const breakPulse = ref(0)
const taskInput = ref<HTMLInputElement | null>(null)
const inlineTaskTitle = ref('')
const inlineCategoryId = ref('')
const inlineTaskId = ref('')
const taskForm = reactive({ title: '', description: '', categoryId: '', clientId: 'cl1', projectId: 'p1', estimateMinutes: 60, isShared: false })
const manualForm = reactive({ taskId: '', startedAt: '', endedAt: '', blockers: ['None'] as string[] })
const profileForm = reactive({ displayName: '', team: 'Software' })
const settingsForm = reactive({ idleThresholdMinutes: 5, nudgeCadenceMinutes: 90, breezyVerbosity: 'gentle', muted: false, locationEnabled: false, activityEnabled: true })
const tabSessionTokenKey = 'breezy-tab-session-token'
const themeStorageKey = 'breezy-theme-mode'

const currentUserId = computed(() => state.value?.user.id || 'u1')
const activeEntry = computed(() => state.value?.entries.find((entry) => entry.userId === currentUserId.value && !entry.endedAt) || null)
const activeTask = computed(() => activeEntry.value ? state.value?.tasks.find((task) => task.id === activeEntry.value?.taskId) || null : null)
const latestUserTask = computed(() => {
  const tasks = state.value?.tasks.filter((task) => task.ownerId === currentUserId.value) || []
  return tasks.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] || null
})
const currentTask = computed(() => activeTask.value || state.value?.tasks.find((task) => task.id === selectedTaskId.value) || latestUserTask.value)
const currentCategoryName = computed(() => currentTask.value ? categoryName(currentTask.value.categoryId) : '')
const hasInlineTaskTitle = computed(() => inlineTaskTitle.value.trim().length > 0)
const shareableTask = computed(() => {
  const title = inlineTaskTitle.value.trim()
  return state.value?.tasks.find((task) => task.id === inlineTaskId.value && task.ownerId === currentUserId.value && task.title === title && task.categoryId === inlineCategoryId.value) || null
})
const primaryTimerLabel = computed(() => {
  if (!activeEntry.value) return 'Start'
  return pausedAt.value ? 'Resume' : 'Take a Break'
})
const activeMood = computed(() => {
  if (settingsForm.muted) return 'idle'
  if (activeEntry.value && elapsedSeconds.value > 2700) return 'cheering'
  const latest = state.value?.journey.at(-1)
  return latest?.mood || 'happy'
})
const personal = computed(() => state.value?.dashboards.personal)
const company = computed(() => state.value?.dashboards.company)
const ownEntries = computed(() => state.value?.entries.filter((entry) => entry.userId === currentUserId.value && entry.endedAt) || [])
const teamEntries = computed(() => state.value?.entries.filter((entry) => entry.endedAt) || [])
const todayEntries = computed(() => (entryScope.value === 'Individual' ? ownEntries.value : teamEntries.value).slice(0, 5))
const activeTrackers = computed(() => state.value?.dashboards.activeTrackers || [])
const initials = computed(() => (state.value?.user.displayName || 'AG').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase())
const shareableUsers = computed(() => state.value?.users.filter((user) => user.id !== currentUserId.value) || [])
const pendingInvitations = computed(() => state.value?.taskInvitations.filter((invite) => invite.recipientId === currentUserId.value && invite.status === 'pending') || [])
const sentInvitations = computed(() => state.value?.taskInvitations.filter((invite) => invite.senderId === currentUserId.value) || [])
const sharedTasksForCurrentUser = computed(() => pendingInvitations.value.map((invite) => ({
  invitation: invite,
  task: state.value?.tasks.find((task) => task.id === invite.taskId)
})).filter((row): row is { invitation: ApiState['taskInvitations'][number], task: ApiState['tasks'][number] } => Boolean(row.task)))
const heroTitle = computed(() => {
  if (activeSection.value === 'Dashboard') return audienceMode.value === 'You' ? 'Your Dashboard' : 'Company Dashboard'
  if (activeSection.value === 'Track') return 'Current Tracking Task'
  return activeSection.value
})
const activePageKey = computed(() => {
  if (activeSection.value === 'Track') return 'track'
  if (activeSection.value === 'Breezy Journey') return 'journey'
  return audienceMode.value === 'You' ? 'personal' : 'company'
})
const pageSubtitle = computed(() => {
  if (activeSection.value === 'Track') {
    return activeEntry.value
      ? `${currentTask.value?.title || 'Current task'} is being tracked now.`
      : 'Start a task, capture feedback, and keep today exportable.'
  }
  if (activeSection.value === 'Breezy Journey') return 'A calm timeline of Breezy days, moods, and air clarity.'
  if (audienceMode.value === 'Company') return 'Aggregated process insight without individual performance rankings.'
  return 'Your private time, focus quality, blockers, and working pattern record.'
})
const pageEyebrow = computed(() => audienceMode.value === 'You' ? 'Personal - private' : 'Aggregated - process')

function toggleAudienceMode() {
  if (audienceMode.value === 'You') {
    audienceMode.value = 'Company'
    activeSection.value = 'Dashboard'
    return
  }

  audienceMode.value = 'You'
}

function restoreTheme() {
  if (typeof window === 'undefined') return
  const savedTheme = window.localStorage.getItem(themeStorageKey)
  themeMode.value = savedTheme === 'dark' ? 'dark' : 'light'
  applyTheme()
}

function applyTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = themeMode.value
}

function toggleTheme() {
  themeMode.value = themeMode.value === 'light' ? 'dark' : 'light'
  if (typeof window !== 'undefined') window.localStorage.setItem(themeStorageKey, themeMode.value)
  applyTheme()
}

function openTrack() {
  audienceMode.value = 'You'
  activeSection.value = 'Track'
}

function openPersonalDashboard() {
  audienceMode.value = 'You'
  activeSection.value = 'Dashboard'
}

function openCompanyDashboard() {
  audienceMode.value = 'Company'
  activeSection.value = 'Dashboard'
}

function openJourney() {
  audienceMode.value = 'You'
  activeSection.value = 'Breezy Journey'
}

function tabSessionToken() {
  if (typeof window === 'undefined') return ''
  return window.sessionStorage.getItem(tabSessionTokenKey) || ''
}

function saveTabSessionToken(token?: string) {
  if (typeof window === 'undefined') return
  if (token) window.sessionStorage.setItem(tabSessionTokenKey, token)
  else window.sessionStorage.removeItem(tabSessionTokenKey)
}

function authHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra)
  const token = tabSessionToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

function authFetch<T>(url: string, options: Parameters<typeof $fetch<T>>[1] = {}) {
  return $fetch<T>(url, {
    ...options,
    credentials: 'include',
    headers: authHeaders(options.headers)
  })
}

onMounted(async () => {
  restoreTheme()
  await restoreSession()
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('mousemove', noteActivity)
  window.addEventListener('keydown', noteActivity)
})

onBeforeUnmount(() => {
  if (timerId.value) clearInterval(timerId.value)
  document.removeEventListener('visibilitychange', handleVisibility)
  window.removeEventListener('mousemove', noteActivity)
  window.removeEventListener('keydown', noteActivity)
})

async function loadState(next?: ApiState) {
  state.value = next || await authFetch<ApiState>('/api/bootstrap')
  const runningTask = activeEntry.value ? state.value.tasks.find((task) => task.id === activeEntry.value?.taskId) : null
  if (runningTask) {
    selectedTaskId.value = runningTask.id
    inlineTaskTitle.value = runningTask.title
    inlineCategoryId.value = runningTask.categoryId
    inlineTaskId.value = runningTask.id
  } else if (!inlineTaskTitle.value.trim()) {
    selectedTaskId.value = ''
    inlineTaskId.value = ''
    inlineCategoryId.value ||= state.value.categories[0]?.id || ''
  }
  manualForm.taskId ||= selectedTaskId.value
  profileForm.displayName = state.value.user.displayName
  profileForm.team = state.value.user.team
  Object.assign(settingsForm, state.value.settings)
  syncTimer()
}

async function restoreSession() {
  if (typeof window === 'undefined') return

  try {
    const next = await authFetch<ApiState>('/api/bootstrap')
    await loadState(next)
    isAuthenticated.value = true
    showSignIn.value = false
    breezyMessage.value = `Welcome back, ${next.user.displayName}.`
  } catch {
    isAuthenticated.value = false
  } finally {
    isRestoringSession.value = false
  }
}

async function submitSignIn() {
  signInError.value = ''
  if (!signIn.email.toLowerCase().endsWith('@airgradient.com')) {
    signInError.value = 'Please use your @airgradient.com email.'
    return
  }
  if (!signIn.password) {
    signInError.value = 'Please enter your password.'
    return
  }
  try {
    const next = await authFetch<ApiState>('/api/session', { method: 'POST', body: signIn })
    saveTabSessionToken(next.sessionToken)
    await loadState(next)
    isAuthenticated.value = true
    showSignIn.value = false
    breezyMessage.value = `Welcome back, ${next.user.displayName}.`
  } catch {
    signInError.value = 'Please sign in with an AirGradient work email.'
  }
}

async function logout() {
  await authFetch('/api/session', { method: 'DELETE' }).catch(() => null)
  saveTabSessionToken('')
  if (timerId.value) clearInterval(timerId.value)
  state.value = null
  selectedTaskId.value = ''
  isAuthenticated.value = false
  showSignIn.value = false
  signInError.value = ''
  signIn.password = ''
  elapsedSeconds.value = 0
  activeSection.value = 'Track'
  audienceMode.value = 'You'
}

async function createTask() {
  const members = [currentUserId.value, ...selectedShareUserIds.value]
  const next = await authFetch<ApiState>('/api/tasks', {
    method: 'POST',
    body: {
      ...taskForm,
      isShared: selectedShareUserIds.value.length > 0,
      members
    }
  })
  await loadState(next)
  selectedTaskId.value = next.tasks[0].id
  taskForm.title = ''
  taskForm.description = ''
  taskForm.categoryId = ''
  taskForm.estimateMinutes = 60
  selectedShareUserIds.value = []
  sharePickerOpen.value = false
  showCreateTask.value = false
}

function handleTaskDraftChange() {
  selectedTaskId.value = ''
  inlineTaskId.value = ''
  showShareTaskModal.value = false
  sharePickerOpen.value = false
  selectedShareUserIds.value = []
}

function resetInlineTaskDraft() {
  selectedTaskId.value = ''
  inlineTaskTitle.value = ''
  inlineTaskId.value = ''
  inlineCategoryId.value = state.value?.categories[0]?.id || ''
  showShareTaskModal.value = false
  sharePickerOpen.value = false
  selectedShareUserIds.value = []
}

function selectInlineCategory(categoryId: string) {
  inlineCategoryId.value = categoryId
  handleTaskDraftChange()
}

async function ensureInlineTask() {
  const title = inlineTaskTitle.value.trim()
  if (!title) return ''
  if (shareableTask.value) return shareableTask.value.id

  const categoryId = inlineCategoryId.value || state.value?.categories[0]?.id || 'c1'
  const next = await authFetch<ApiState>('/api/tasks', {
    method: 'POST',
    body: {
      title,
      description: '',
      categoryId,
      clientId: 'cl1',
      projectId: 'p1',
      estimateMinutes: 60,
      members: [currentUserId.value]
    }
  })
  await loadState(next)
  const created = next.tasks.find((task) => task.title === title && task.ownerId === next.user.id && task.categoryId === categoryId) || next.tasks[0]
  selectedTaskId.value = created.id
  inlineTaskId.value = created.id
  inlineTaskTitle.value = created.title
  inlineCategoryId.value = created.categoryId
  return created.id
}

async function startTimer() {
  const taskId = await ensureInlineTask()
  if (!taskId) return
  const next = await authFetch<ApiState>('/api/timer-start', { method: 'POST', body: { taskId } })
  pauses.value = []
  contextSwitches.value = 0
  idleSeconds.value = 0
  await loadState(next)
  breezyMessage.value = 'You are in the zone, keep going.'
}

async function handlePrimaryTimerAction() {
  if (!activeEntry.value) {
    if (!hasInlineTaskTitle.value) {
      taskInput.value?.focus()
      breezyMessage.value = 'Add a task name first, then start tracking.'
      return
    }
    await startTimer()
    return
  }
  if (pausedAt.value) {
    resumeTimer()
    return
  }
  pauseTimer()
}

async function shareCurrentTask() {
  if (!shareableTask.value || !selectedShareUserIds.value.length) return
  const next = await authFetch<ApiState>('/api/tasks-share', {
    method: 'POST',
    body: {
      taskId: shareableTask.value.id,
      recipientIds: selectedShareUserIds.value
    }
  })
  await loadState(next)
  selectedShareUserIds.value = []
  showShareTaskModal.value = false
  sharePickerOpen.value = false
  breezyMessage.value = 'Task invitation sent.'
}

function pauseTimer() {
  pausedAt.value = new Date().toISOString()
  breezyMessage.value = 'Take a breath. The timer is paused.'
}

function takeBreak() {
  breakPulse.value += 1
  breezyMessage.value = 'Do not forget to drink water while you take a break.'
}

function resumeTimer() {
  if (pausedAt.value) pauses.value.push({ startedAt: pausedAt.value, endedAt: new Date().toISOString() })
  pausedAt.value = null
  breezyMessage.value = 'Back at it, gently.'
}

function stopTimer() {
  lastStoppedEntry.value = activeEntry.value?.id || null
  feedbackError.value = ''
  showFeedback.value = true
}

async function saveFeedback(payload?: { flowQuality: FlowQuality, efficiencyFeel: EfficiencyFeel, energy: EnergyLevel, note: string, blockers: string[] }) {
  if (isSavingFeedback.value) return
  if (!lastStoppedEntry.value) {
    feedbackError.value = 'No active session is available to save. Refresh the page and start a new timer.'
    return
  }

  feedbackError.value = ''
  isSavingFeedback.value = true
  try {
    const next = await authFetch<ApiState>('/api/timer-stop', {
      method: 'POST',
      body: {
        entryId: lastStoppedEntry.value,
        idleSeconds: idleSeconds.value,
        contextSwitches: contextSwitches.value,
        pauses: pauses.value,
        feedback: payload,
        blockers: payload?.blockers || ['None']
      }
    })
    showFeedback.value = false
    lastStoppedEntry.value = null
    await loadState(next)
    resetInlineTaskDraft()
    breezyMessage.value = payload?.flowQuality === 'Great flow' ? 'That was clear-sky work. Nicely tended.' : 'Session saved. Thanks for the honest signal.'
  } catch {
    await loadState().catch(() => null)
    feedbackError.value = 'Could not save this session. The timer is out of sync with the server, likely after a restart. Refresh and start a new timer.'
  } finally {
    isSavingFeedback.value = false
  }
}

async function addManualEntry() {
  const next = await authFetch<ApiState>('/api/manual-entry', {
    method: 'POST',
    body: {
      ...manualForm,
      feedback: { flowQuality: 'Neutral', efficiencyFeel: 'Felt manual', energy: 'OK', note: 'Retroactive entry' }
    }
  })
  await loadState(next)
  breezyMessage.value = 'Manual entry added and clearly marked.'
  showManualEntry.value = false
}

async function saveProfile() {
  const next = await authFetch<ApiState>('/api/profile', { method: 'PATCH', body: profileForm })
  await loadState(next)
}

async function saveSettings() {
  const next = await authFetch<ApiState>('/api/settings', { method: 'PATCH', body: { settings: settingsForm } })
  await loadState(next)
}

async function runInsight(scope: 'personal' | 'company') {
  const result = await authFetch<{ degraded: boolean, suggestion: string }>('/api/insights', { method: 'POST', body: { scope, team: teamFilter.value } })
  insight.value = result.suggestion
}

async function refreshCompany() {
  const next = await authFetch<ApiState>(`/api/bootstrap?team=${teamFilter.value}`)
  await loadState(next)
}

function exportUrl(format: 'csv' | 'json') {
  return `/api/export?format=${format}`
}

async function acceptInvitation(invitationId: string) {
  const next = await authFetch<ApiState>('/api/invitations', { method: 'POST', body: { invitationId } })
  await loadState(next)
  const acceptedInvite = next.taskInvitations.find((invite) => invite.id === invitationId)
  if (acceptedInvite) selectedTaskId.value = acceptedInvite.taskId
  breezyMessage.value = 'Shared task joined. You can track your contribution now.'
}

function syncTimer() {
  if (timerId.value) clearInterval(timerId.value)
  if (!activeEntry.value) {
    elapsedSeconds.value = 0
    return
  }
  const tick = () => {
    if (pausedAt.value || !activeEntry.value) return
    elapsedSeconds.value = secondsBetween(activeEntry.value.startedAt, new Date()) - idleSeconds.value
  }
  tick()
  timerId.value = setInterval(tick, 1000)
}

let lastActivity = Date.now()
function noteActivity() {
  const threshold = Number(settingsForm.idleThresholdMinutes || 5) * 60 * 1000
  const idleFor = Date.now() - lastActivity
  if (activeEntry.value && idleFor > threshold) {
    idleSeconds.value += Math.round(idleFor / 1000)
    breezyMessage.value = 'Welcome back. Keep, discard, or split idle time from Settings if needed.'
  }
  lastActivity = Date.now()
}

function handleVisibility() {
  contextSwitches.value = countContextSwitches(contextSwitches.value, document.hidden)
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, seconds)
  const h = Math.floor(safe / 3600).toString().padStart(2, '0')
  const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0')
  const s = Math.floor(safe % 60).toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatEntryTime(value: string | null) {
  if (!value) return 'In progress'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function entryFeeling(entry: ApiState['entries'][number]) {
  if (!entry.feedback) return 'Skipped feedback'
  return [entry.feedback.flowQuality, entry.feedback.efficiencyFeel, entry.feedback.energy].join(' / ')
}

function taskName(taskId: string) {
  return state.value?.tasks.find((task) => task.id === taskId)?.title || 'Unknown task'
}

function categoryName(categoryId: string) {
  return state.value?.categories.find((category) => category.id === categoryId)?.name || 'Other'
}

function userName(userId: string) {
  return state.value?.users.find((user) => user.id === userId)?.displayName || 'Team member'
}

function shareButtonLabel() {
  if (!selectedShareUserIds.value.length) return 'Share task'
  return `Invite ${selectedShareUserIds.value.length} user${selectedShareUserIds.value.length > 1 ? 's' : ''}`
}

function invitationStatusLabel(invitation: ApiState['taskInvitations'][number]) {
  return `${userName(invitation.recipientId)} - ${invitation.status}`
}

function invitationForRecipient(userId: string) {
  if (!shareableTask.value) return ''
  const invite = sentInvitations.value.find((item) => item.taskId === shareableTask.value?.id && item.recipientId === userId)
  return invite ? invite.status : ''
}

function userInitials(displayName: string) {
  return displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}
</script>

<template>
  <main v-if="isRestoringSession" class="auth-shell">
    <article class="signin-card status-card">
      <span class="breezy-crop signin-breezy" aria-hidden="true"></span>
      <p class="eyebrow">AirGradient Time Tracker</p>
      <h2>Restoring workspace</h2>
    </article>
  </main>

  <main v-else-if="!isAuthenticated" class="auth-shell">
    <section class="signin-screen">
      <article class="signin-card">
        <span class="breezy-crop signin-breezy" aria-hidden="true"></span>
        <p class="eyebrow">AirGradient sign in</p>
        <h2>{{ showSignIn ? 'Sign in to continue' : 'Welcome to the time tracker' }}</h2>

        <form v-if="showSignIn" class="signin-form" @submit.prevent="submitSignIn">
          <label>
            Work email
            <input v-model.trim="signIn.email" required type="email" autocomplete="email" placeholder="name@airgradient.com">
          </label>
          <label>
            Password
            <input v-model="signIn.password" required type="password" autocomplete="current-password" placeholder="Enter password">
          </label>
          <p v-if="signInError" class="form-error">{{ signInError }}</p>
          <button type="submit" class="btn primary">Continue</button>
        </form>

        <button v-else type="button" class="btn primary signin-primary" @click="showSignIn = true">Sign in</button>
      </article>
    </section>
  </main>

  <main v-else-if="state" class="app-shell">
    <aside class="sidebar" aria-label="Workspace navigation">
      <div class="brand">
        <span class="breezy-crop brand-avatar" aria-hidden="true"></span>
        <div class="brand-name">
          AirGradient
          <small>Time Tracker</small>
        </div>
      </div>

      <div class="lens-toggle" role="group" aria-label="Data lens">
        <button type="button" :class="{ on: audienceMode === 'You' }" @click="audienceMode = 'You'">You</button>
        <button type="button" :class="{ on: audienceMode === 'Company' }" @click="openCompanyDashboard">Company</button>
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
          Breezy Journey
        </button>
      </nav>

      <div class="divider"></div>

      <nav class="nav-group" aria-label="Quick actions">
        <p class="nav-label">Actions</p>
        <button type="button" class="nav-item" @click="showCreateTask = true">
          <span class="ico" aria-hidden="true">+</span>
          New task
        </button>
        <button type="button" class="nav-item" @click="showManualEntry = true">
          <span class="ico" aria-hidden="true">M</span>
          Manual entry
        </button>
      </nav>

      <div class="nav-spacer"></div>

      <button type="button" class="nav-item quiet" :aria-label="`Switch to ${themeMode === 'light' ? 'dark' : 'light'} mode`" @click="toggleTheme">
        <span class="ico" aria-hidden="true">{{ themeMode === 'light' ? 'D' : 'L' }}</span>
        {{ themeMode === 'light' ? 'Dark mode' : 'Light mode' }}
      </button>

      <div class="user-card">
        <span class="avatar">{{ initials }}</span>
        <div>
          <p class="nm">{{ state.user.displayName }}</p>
          <p class="rl">{{ state.user.team }}</p>
        </div>
      </div>
      <button type="button" class="btn logout-button" @click="logout">Log out</button>
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
            <button v-if="activeSection === 'Track'" type="button" class="btn ghost" @click="showManualEntry = true">Manual entry</button>
            <button type="button" class="btn primary" @click="showCreateTask = true">New task</button>
          </div>
        </header>

        <template v-if="activeSection === 'Track'">
          <section class="track-grid">
            <article class="card pad timer-panel">
              <div class="card-h">
                <div>
                  <p class="eyebrow">Tracking</p>
                  <h2>{{ activeTask?.title || inlineTaskTitle || 'Choose a task' }}</h2>
                </div>
                <span class="status-pill" :class="{ live: activeEntry }">{{ activeEntry ? 'Tracking now' : 'Ready' }}</span>
              </div>

              <div class="task-composer">
                <label>
                  Task
                  <input
                    ref="taskInput"
                    v-model="inlineTaskTitle"
                    aria-label="Task name"
                    placeholder="What are you working on?"
                    @input="handleTaskDraftChange"
                  >
                </label>
                <div class="category-tags" aria-label="Choose category">
                  <button
                    v-for="(category, index) in state.categories"
                    :key="category.id"
                    type="button"
                    class="chip"
                    :class="{ sel: inlineCategoryId === category.id }"
                    @click="selectInlineCategory(category.id)"
                  >
                    <i :class="`tag-dot tag-${index + 1}`"></i>{{ category.name }}
                  </button>
                </div>
              </div>

              <div class="timer-face">
                <div class="timer-readout mono">{{ activeEntry ? formatDuration(elapsedSeconds) : '00:00:00' }}</div>
                <div class="timer-controls">
                  <button
                    type="button"
                    class="timer-primary-button"
                    :class="{ 'is-start': !activeEntry, 'is-break': activeEntry && !pausedAt, 'is-resume': pausedAt }"
                    :disabled="!hasInlineTaskTitle && !activeEntry"
                    :aria-label="primaryTimerLabel"
                    @click="handlePrimaryTimerAction"
                  >
                    {{ primaryTimerLabel }}
                  </button>
                  <button v-if="activeEntry" type="button" class="btn orange" @click="stopTimer">Stop</button>
                </div>
                <p class="breezy-line">{{ breezyMessage }}</p>
              </div>

              <dl class="timer-stats">
                <div>
                  <dt>Task category</dt>
                  <dd>{{ categoryName(inlineCategoryId) || currentCategoryName || 'Unselected' }}</dd>
                </div>
                <div>
                  <dt>Idle</dt>
                  <dd>{{ Math.round(idleSeconds / 60) }}m</dd>
                </div>
                <div>
                  <dt>Context switches</dt>
                  <dd>{{ contextSwitches }}</dd>
                </div>
              </dl>

              <div v-if="shareableTask || sharedTasksForCurrentUser.length" class="sharing-panel">
                <button v-if="shareableTask" type="button" class="btn ghost" @click="showShareTaskModal = true">Share task</button>
                <div v-for="row in sharedTasksForCurrentUser" :key="row.invitation.id" class="shared-task-row">
                  <div>
                    <strong>{{ row.task.title }}</strong>
                    <small>Invitation from {{ userName(row.invitation.senderId) }}</small>
                  </div>
                  <button type="button" class="btn sm primary" @click="acceptInvitation(row.invitation.id)">Join</button>
                </div>
              </div>
            </article>

            <BreezyCompanion :mood="activeMood" :muted="settingsForm.muted" :message="breezyMessage" :motion-key="breakPulse" featured />

            <article class="card pad sessions-panel">
              <div class="card-h">
                <div>
                  <h2>Today's entries</h2>
                  <p class="sub">{{ entryScope === 'Individual' ? 'Your tracked sessions' : 'Team sessions without individual ranking' }}</p>
                </div>
                <div class="segmented" role="group" aria-label="Filter entries">
                  <button type="button" :class="{ selected: entryScope === 'Individual' }" @click="entryScope = 'Individual'">Individual</button>
                  <button type="button" :class="{ selected: entryScope === 'Team' }" @click="entryScope = 'Team'">Team</button>
                </div>
              </div>

              <p v-if="!todayEntries.length" class="empty">No tracked time yet today. Add a task to begin.</p>
              <div v-for="entry in todayEntries" :key="entry.id" class="session-row" :class="{ detailed: entryScope === 'Individual' }">
                <template v-if="entryScope === 'Individual'">
                  <div class="session-main">
                    <span>Task</span>
                    <strong>{{ taskName(entry.taskId) }}</strong>
                  </div>
                  <div class="session-meta">
                    <span>Time spent</span>
                    <strong>{{ formatDuration(entry.durationSeconds) }}</strong>
                  </div>
                  <div class="session-times">
                    <span>Start {{ formatEntryTime(entry.startedAt) }}</span>
                    <span>Finish {{ formatEntryTime(entry.endedAt) }}</span>
                  </div>
                  <div class="session-feeling">
                    <span>Feeling</span>
                    <strong>{{ entryFeeling(entry) }}</strong>
                    <small v-if="entry.feedback?.note">{{ entry.feedback.note }}</small>
                    <small v-if="entry.isManual">Manual</small>
                  </div>
                </template>
                <template v-else>
                  <strong>{{ taskName(entry.taskId) }}</strong>
                  <span>{{ formatDuration(entry.durationSeconds) }}</span>
                  <small>{{ userName(entry.userId) }} <b v-if="entry.isManual">Manual</b></small>
                </template>
              </div>
            </article>
          </section>
        </template>

        <section v-else-if="activeSection === 'Dashboard' && audienceMode === 'You'" class="dashboard-grid">
          <article class="metric card"><span>Your hours</span><strong>{{ personal.totalHours }}h</strong></article>
          <article class="metric card"><span>Great flow</span><strong>{{ personal.flow.find((f: any) => f.name === 'Great flow')?.count || 0 }}</strong></article>
          <article class="metric card"><span>Top blocker</span><strong>{{ personal.blockers[0]?.name || 'Clear skies' }}</strong></article>
          <article class="metric card export-metric">
            <span>Raw data</span>
            <div class="export-actions">
              <a :href="exportUrl('csv')" download>CSV</a>
              <a :href="exportUrl('json')" download>JSON</a>
            </div>
          </article>
          <article class="card pad wide">
            <div class="card-h">
              <h2>Hours by category</h2>
              <p class="sub">Personal detail</p>
            </div>
            <MetricChart :labels="personal.byCategory.map((item: any) => item.name)" :values="personal.byCategory.map((item: any) => item.hours)" label="Hours" />
          </article>
          <article class="card pad">
            <h2>Estimate vs actual</h2>
            <div v-for="row in personal.estimateVariance" :key="row.task" class="session-row compact">
              <strong>{{ row.task }}</strong>
              <span>{{ row.actualMinutes }}m</span>
              <small>{{ row.varianceMinutes >= 0 ? '+' : '' }}{{ row.varianceMinutes }}m</small>
            </div>
          </article>
          <article class="card pad">
            <h2>AI Insights</h2>
            <p class="muted">{{ insight || 'Run an insight when you want a suggestion.' }}</p>
            <button type="button" class="btn primary" @click="runInsight('personal')">Personal suggestion</button>
          </article>
          <article class="card pad">
            <h2>Medals</h2>
            <div v-for="medal in state.medals.slice(0, 4)" :key="medal.code" class="session-row compact">
              <strong>{{ medal.name }}</strong>
              <span>{{ medal.awarded ? 'Awarded' : 'Locked' }}</span>
              <small>{{ medal.description }}</small>
            </div>
          </article>
          <article class="card pad settings-grid">
            <h2>Profile & settings</h2>
            <label>Display name <input v-model="profileForm.displayName"></label>
            <label>Team
              <select v-model="profileForm.team">
                <option>COMMS</option>
                <option>Hardware</option>
                <option>Software</option>
              </select>
            </label>
            <label>Breezy voice
              <select v-model="settingsForm.breezyVerbosity">
                <option>quiet</option>
                <option>gentle</option>
                <option>chatty</option>
              </select>
            </label>
            <label class="check"><input v-model="settingsForm.muted" type="checkbox"> Global mute</label>
            <button type="button" class="btn primary" @click="saveProfile(); saveSettings()">Save profile</button>
          </article>
        </section>

        <section v-else-if="activeSection === 'Dashboard' && audienceMode === 'Company'" class="dashboard-grid">
          <article class="card pad filter-panel">
            <label>Team filter
              <select v-model="teamFilter" @change="refreshCompany">
                <option>All</option>
                <option>COMMS</option>
                <option>Hardware</option>
                <option>Software</option>
              </select>
            </label>
          </article>
          <article class="metric card"><span>Aggregated hours</span><strong>{{ company.totalHours }}h</strong></article>
          <article class="card pad wide">
            <div class="card-h">
              <h2>Aggregated category time</h2>
              <p class="sub">Company process view</p>
            </div>
            <MetricChart :labels="company.byCategory.map((item: any) => item.name)" :values="company.byCategory.map((item: any) => item.hours)" label="Hours" color="#FC7E10" />
          </article>
          <article class="card pad">
            <h2>Blocker ranking</h2>
            <div v-for="blocker in company.blockers" :key="blocker.name" class="session-row compact">
              <strong>{{ blocker.name }}</strong>
              <span>{{ blocker.hours }}h</span>
              <small>{{ blocker.count }} sessions</small>
            </div>
          </article>
          <article class="card pad">
            <h2>Shared effort</h2>
            <div v-for="tracker in activeTrackers" :key="tracker.userId + tracker.taskId" class="session-row compact">
              <strong>{{ tracker.displayName }}</strong>
              <span>tracking now</span>
              <small>{{ taskName(tracker.taskId) }}</small>
            </div>
            <p v-if="!activeTrackers.length" class="empty">No one is tracking a shared task right now.</p>
          </article>
          <article class="card pad">
            <h2>AI Insights</h2>
            <p class="muted">{{ insight || 'Company insights stay aggregated.' }}</p>
            <button type="button" class="btn orange" @click="runInsight('company')">Company suggestion</button>
          </article>
        </section>

        <section v-else class="card pad forest-card">
          <div class="card-h">
            <div>
              <h2>Breezy Journey</h2>
              <p class="sub">A calm look back at weekly Breezy days, moods, and clear-air moments.</p>
            </div>
            <div class="road-tabs" aria-label="Journey view">
              <span class="selected">Timeline</span>
              <span>Calendar</span>
              <span>Moods</span>
            </div>
          </div>

          <div class="journey-toolbar">
            <div class="month-pills" aria-label="Journey months">
              <span>March</span>
              <span class="active">April</span>
              <span class="active">May</span>
              <span>June</span>
            </div>
            <span class="reward-pill">{{ state.journey.length }} Breezy days saved</span>
          </div>

          <div class="roadmap">
            <div class="months">
              <span>March</span>
              <span>April</span>
              <span>May</span>
            </div>
            <div class="sky-strip" aria-label="Breezy mood calendar">
              <div class="sky-day calm"><strong>Calm</strong><span>steady focus</span></div>
              <div class="sky-day"><strong>Clear</strong><span>deep work</span></div>
              <div class="sky-day cloudy"><strong>Cloudy</strong><span>small blockers</span></div>
              <div class="sky-day calm"><strong>Light</strong><span>easy handoff</span></div>
              <div class="sky-day"><strong>Bright</strong><span>best day</span></div>
              <div class="sky-day calm"><strong>Settled</strong><span>good rhythm</span></div>
            </div>
            <svg class="road" viewBox="0 0 1200 220" preserveAspectRatio="none" aria-hidden="true">
              <path class="base" d="M18 150 C120 58 196 58 295 126 S480 198 602 120 S782 42 914 108 S1086 178 1182 88" />
              <path class="center" d="M18 150 C120 58 196 58 295 126 S480 198 602 120 S782 42 914 108 S1086 178 1182 88" />
            </svg>
            <div
              v-for="(day, index) in state.journey.slice(-10)"
              :key="day.date"
              class="marker"
              :class="[`m${index + 1}`, { personal: day.airClarityScore > 82, seasonal: day.mood === 'happy' }]"
            >
              <button class="pin" type="button" :aria-label="`Breezy day ${day.weekLabel}`"><span class="breezy-road-face"></span></button>
              <div class="flag">
                <strong>{{ day.weekLabel }}</strong>
                <span>{{ day.hours }}h - {{ day.mood }}</span>
                <p>Air clarity {{ day.airClarityScore }} from tracked work, breaks, and feedback.</p>
              </div>
            </div>
            <div class="week-row">
              <span v-for="week in 12" :key="week">W{{ week }}</span>
            </div>
          </div>

          <div class="legend">
            <div class="legend-items">
              <span class="legend-item"><i class="dot"></i>Deep work</span>
              <span class="legend-item"><i class="dot teal"></i>Clear air</span>
              <span class="legend-item"><i class="dot gold"></i>Admin</span>
              <span class="legend-item"><i class="dot coral"></i>Friction</span>
            </div>
            <span>Each Breezy holds a saved task memory</span>
          </div>
        </section>
      </div>

      <FeedbackModal v-if="showFeedback" :error="feedbackError" :saving="isSavingFeedback" @save="saveFeedback" @skip="saveFeedback()" />
      <div v-if="showShareTaskModal && shareableTask" class="modal-backdrop">
        <section class="task-modal share-modal" aria-modal="true" role="dialog" aria-labelledby="share-task-title">
          <div class="modal-title-row">
            <div>
              <h2 id="share-task-title">Share task</h2>
              <p>{{ shareableTask.title }}</p>
            </div>
            <button type="button" class="icon-close" aria-label="Close share task" @click="showShareTaskModal = false">x</button>
          </div>

          <div class="share-user-grid">
            <label v-for="user in shareableUsers" :key="user.id" class="share-user-card">
              <input v-model="selectedShareUserIds" type="checkbox" :value="user.id" :disabled="invitationForRecipient(user.id) === 'pending'">
              <span class="share-user-avatar">{{ userInitials(user.displayName) }}</span>
              <span class="share-user-copy">
                <strong>{{ user.displayName }}</strong>
                <small>{{ user.email }}</small>
                <em>{{ user.team }}</em>
              </span>
              <span v-if="invitationForRecipient(user.id)" class="invite-chip">{{ invitationForRecipient(user.id) }}</span>
            </label>
            <p v-if="!shareableUsers.length" class="empty">No teammates are available yet.</p>
          </div>

          <button type="button" class="btn primary" :disabled="!selectedShareUserIds.length" @click="shareCurrentTask">
            {{ selectedShareUserIds.length ? `Send invite to ${selectedShareUserIds.length}` : 'Select user' }}
          </button>
        </section>
      </div>
      <div v-if="showCreateTask" class="modal-backdrop">
        <form class="task-modal" @submit.prevent="createTask">
          <div class="modal-title-row">
            <h2>Create task</h2>
            <button type="button" class="icon-close" aria-label="Close create task" @click="showCreateTask = false">x</button>
          </div>
          <input v-model="taskForm.title" required placeholder="Task title" aria-label="Task title">
          <textarea v-model="taskForm.description" rows="3" placeholder="Description" aria-label="Task description"></textarea>
          <div class="inline-fields">
            <select v-model="taskForm.categoryId" aria-label="Category">
              <option disabled value="">Categories</option>
              <option v-for="category in state.categories" :key="category.id" :value="category.id">{{ category.name }}</option>
            </select>
            <input v-model.number="taskForm.estimateMinutes" min="1" type="number" aria-label="Estimate minutes">
          </div>
          <button type="button" class="btn ghost" @click="sharePickerOpen = !sharePickerOpen">{{ shareButtonLabel() }}</button>
          <div v-if="sharePickerOpen" class="share-picker">
            <label v-for="user in shareableUsers" :key="user.id" class="check">
              <input v-model="selectedShareUserIds" type="checkbox" :value="user.id">
              {{ user.displayName }} <span>{{ user.team }}</span>
            </label>
            <p v-if="!shareableUsers.length" class="empty">No teammates are available yet.</p>
          </div>
          <div v-if="sentInvitations.length" class="share-picker compact">
            <div v-for="invite in sentInvitations.slice(0, 4)" :key="invite.id" class="invite-status">
              <strong>{{ taskName(invite.taskId) }}</strong>
              <span>{{ invitationStatusLabel(invite) }}</span>
            </div>
          </div>
          <button type="submit" class="btn primary">Add task</button>
        </form>
      </div>

      <div v-if="showManualEntry" class="modal-backdrop">
        <form class="task-modal" @submit.prevent="addManualEntry">
          <div class="modal-title-row">
            <h2>Manual entry</h2>
            <button type="button" class="icon-close" aria-label="Close manual entry" @click="showManualEntry = false">x</button>
          </div>
          <select v-model="manualForm.taskId" aria-label="Manual task">
            <option v-for="task in state.tasks" :key="task.id" :value="task.id">{{ task.title }}</option>
          </select>
          <input v-model="manualForm.startedAt" required type="datetime-local" aria-label="Manual start">
          <input v-model="manualForm.endedAt" required type="datetime-local" aria-label="Manual end">
          <button type="submit" class="btn primary">Add manual entry</button>
        </form>
      </div>
    </section>
  </main>
</template>
