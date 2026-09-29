import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'

export type AudienceMode = 'You' | 'Company'
export type AppSection = 'Track' | 'Dashboard' | 'Work Journey' | 'Settings'

export function createAppNavigation(options: {
  activeTaskTitle?: MaybeRefOrGetter<string | undefined>
  hasActiveEntry?: MaybeRefOrGetter<boolean>
} = {}) {
  const audienceMode = ref<AudienceMode>('You')
  const activeSection = ref<AppSection>('Track')

  const heroTitle = computed(() => {
    if (activeSection.value === 'Settings') return 'Settings'
    if (activeSection.value === 'Dashboard') return audienceMode.value === 'You' ? 'Your Dashboard' : 'Company Dashboard'
    if (activeSection.value === 'Track') return 'Current Tracking Task'
    return activeSection.value
  })

  const activePageKey = computed(() => {
    if (activeSection.value === 'Settings') return 'settings'
    if (activeSection.value === 'Track') return 'track'
    if (activeSection.value === 'Work Journey') return 'journey'
    return audienceMode.value === 'You' ? 'personal' : 'company'
  })

  const pageSubtitle = computed(() => {
    if (activeSection.value === 'Settings') return 'Manage your profile, preferences, and privacy.'
    if (activeSection.value === 'Track') {
      const taskTitle = options.activeTaskTitle ? toValue(options.activeTaskTitle) : undefined
      const hasActiveEntry = options.hasActiveEntry ? toValue(options.hasActiveEntry) : Boolean(taskTitle)
      return hasActiveEntry
        ? `${taskTitle || 'Current task'} is being tracked now.`
        : 'Start a task, capture feedback, and keep today exportable.'
    }
    if (activeSection.value === 'Work Journey') return 'Revisit completed tasks, time spent, and task memories for the selected week.'
    if (audienceMode.value === 'Company') return 'Aggregated process insight without individual performance rankings.'
    return 'Analyze your week’s time, focus quality, blockers, and working patterns.'
  })

  const pageEyebrow = computed(() => activeSection.value === 'Settings'
    ? 'Account - private'
    : audienceMode.value === 'You' ? 'Personal - private' : 'Aggregated - process')

  function toggleAudienceMode() {
    if (audienceMode.value === 'You') {
      openCompanyDashboard()
      return
    }
    audienceMode.value = 'You'
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
    activeSection.value = 'Work Journey'
  }

  function openSettings() {
    audienceMode.value = 'You'
    activeSection.value = 'Settings'
  }

  return {
    activePageKey,
    activeSection,
    audienceMode,
    heroTitle,
    openCompanyDashboard,
    openJourney,
    openPersonalDashboard,
    openSettings,
    openTrack,
    pageEyebrow,
    pageSubtitle,
    toggleAudienceMode
  }
}

export function useAppNavigation(options: Parameters<typeof createAppNavigation>[0] = {}) {
  return createAppNavigation(options)
}
