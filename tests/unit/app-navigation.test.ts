import { describe, expect, it } from 'vitest'
import { createAppNavigation } from '../../frontend/composables/useAppNavigation'

describe('application navigation state', () => {
  it('starts on the private Track destination', () => {
    const navigation = createAppNavigation()

    expect(navigation.audienceMode.value).toBe('You')
    expect(navigation.activeSection.value).toBe('Track')
    expect(navigation.activePageKey.value).toBe('track')
    expect(navigation.heroTitle.value).toBe('Current Tracking Task')
    expect(navigation.pageEyebrow.value).toBe('Personal - private')
    expect(navigation.pageSubtitle.value).toBe('Start a task, capture feedback, and keep today exportable.')
  })

  it('moves between personal, company, Work Journey, Settings, and Track destinations', () => {
    const navigation = createAppNavigation()

    navigation.openPersonalDashboard()
    expect(destination(navigation)).toEqual(['You', 'Dashboard', 'personal', 'Your Dashboard'])

    navigation.openCompanyDashboard()
    expect(destination(navigation)).toEqual(['Company', 'Dashboard', 'company', 'Company Dashboard'])
    expect(navigation.pageEyebrow.value).toBe('Aggregated - process')

    navigation.openJourney()
    expect(destination(navigation)).toEqual(['You', 'Work Journey', 'journey', 'Work Journey'])

    navigation.openSettings()
    expect(destination(navigation)).toEqual(['You', 'Settings', 'settings', 'Settings'])
    expect(navigation.pageEyebrow.value).toBe('Account - private')

    navigation.openTrack()
    expect(destination(navigation)).toEqual(['You', 'Track', 'track', 'Current Tracking Task'])
  })

  it('uses the active task title only in the Track subtitle', () => {
    const navigation = createAppNavigation({ activeTaskTitle: 'Sensor QA review' })

    expect(navigation.pageSubtitle.value).toBe('Sensor QA review is being tracked now.')
    navigation.openCompanyDashboard()
    expect(navigation.pageSubtitle.value).toBe('Aggregated process insight without individual performance rankings.')
  })
})

function destination(navigation: ReturnType<typeof createAppNavigation>) {
  return [
    navigation.audienceMode.value,
    navigation.activeSection.value,
    navigation.activePageKey.value,
    navigation.heroTitle.value
  ]
}
