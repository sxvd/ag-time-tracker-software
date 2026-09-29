import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import SettingsPage from '../../frontend/features/settings/SettingsPage.vue'

const user = {
  displayName: 'Mog',
  email: 'mog@airgradient.com',
  team: 'Software'
}

const settings = {
  idleThresholdMinutes: 5,
  nudgeCadenceMinutes: 50,
  breezyVerbosity: 'gentle' as const,
  muted: false,
  locationEnabled: true,
  activityEnabled: true,
  locationLabels: ['Home office', 'AirGradient office']
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SettingsPage', () => {
  it('renders profile and activity/privacy settings from persisted values', async () => {
    const wrapper = await mountSettingsPage()

    expect(wrapper.get('h2:nth-of-type(1)').text()).toBe('Profile')
    expect(wrapper.text()).toContain('Activity & Privacy')
    expect(wrapper.text()).not.toContain('Appearance')
    expect(wrapper.text()).not.toContain('Nudge cadence')
    expect(field(wrapper, 'display-name').element.value).toBe('Mog')
    expect(field(wrapper, 'idle-threshold').element.value).toBe('5')
    expect(wrapper.text()).toContain('Ask me after no activity for')
    expect(wrapper.text()).toContain('Home office')
  })

  it('disables Save while unchanged, invalid, or saving', async () => {
    const wrapper = await mountSettingsPage()
    const save = wrapper.get<HTMLButtonElement>('[type="submit"]')

    expect(save.element.disabled).toBe(true)

    await field(wrapper, 'display-name').setValue('Mog Updated')
    expect(save.element.disabled).toBe(false)

    await field(wrapper, 'display-name').setValue('   ')
    expect(save.element.disabled).toBe(true)

    await wrapper.setProps({ saving: true })
    await field(wrapper, 'display-name').setValue('Mog Updated')
    expect(save.element.disabled).toBe(true)
  })

  it('emits one complete normalized payload for a valid edit', async () => {
    const wrapper = await mountSettingsPage()
    await field(wrapper, 'display-name').setValue('  Mog Updated  ')
    await field(wrapper, 'idle-threshold').setValue('10')

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('save')).toEqual([[
      {
        profile: { displayName: 'Mog Updated', team: 'Software' },
        settings: {
          idleThresholdMinutes: 10,
          nudgeCadenceMinutes: 50,
          breezyVerbosity: 'gentle',
          muted: false,
          locationEnabled: true,
          activityEnabled: true,
          locationLabels: ['Home office', 'AirGradient office']
        }
      }
    ]])
  })

  it.each([
    ['display-name', '', 'Display name is required.'],
    ['display-name', 'x'.repeat(101), 'Display name must be 100 characters or fewer.'],
    ['idle-threshold', '0', 'Ask me after no activity for must be from 1 to 240 minutes.'],
    ['idle-threshold', '241', 'Ask me after no activity for must be from 1 to 240 minutes.'],
    ['idle-threshold', '1.5', 'Ask me after no activity for must be a whole number.']
  ])('rejects invalid %s input', async (id, value, message) => {
    const wrapper = await mountSettingsPage()

    await field(wrapper, id).setValue(value)

    expect(wrapper.text()).toContain(message)
    expect(wrapper.get<HTMLButtonElement>('[type="submit"]').element.disabled).toBe(true)
  })

  it('keeps team within the shared category choices', async () => {
    const wrapper = await mountSettingsPage()

    expect(field(wrapper, 'team').findAll('option').map(option => option.element.value)).toEqual([
      'Software', 'Hardware', 'Firmware', 'Communication', 'Research', 'Commerce', 'Production', 'Other'
    ])
  })

  it('disables activity threshold without destroying its saved value', async () => {
    const wrapper = await mountSettingsPage()

    await field(wrapper, 'activity-enabled').setValue(false)

    expect(field(wrapper, 'idle-threshold').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    const payload = wrapper.emitted('save')?.[0]?.[0] as any
    expect(payload.settings.activityEnabled).toBe(false)
    expect(payload.settings.idleThresholdMinutes).toBe(5)
  })

  it('turns off location usage without blocking label-list editing or destroying saved labels', async () => {
    const wrapper = await mountSettingsPage()

    await field(wrapper, 'location-enabled').setValue(false)

    expect(field(wrapper, 'location-label').attributes('disabled')).toBeUndefined()
    await field(wrapper, 'location-label').setValue('  Bangkok office  ')
    await wrapper.get('[data-testid="add-location-label"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    const payload = wrapper.emitted('save')?.[0]?.[0] as any
    expect(payload.settings.locationEnabled).toBe(false)
    expect(payload.settings.locationLabels).toEqual(['Home office', 'AirGradient office', 'Bangkok office'])
  })

  it('adds trimmed unique labels and removes existing labels', async () => {
    const wrapper = await mountSettingsPage()
    await field(wrapper, 'location-label').setValue('  Bangkok office  ')

    await wrapper.get('[data-testid="add-location-label"]').trigger('click')
    await wrapper.get('[aria-label="Remove Home office"]').trigger('click')
    await wrapper.get('form').trigger('submit')

    const payload = wrapper.emitted('save')?.[0]?.[0] as any
    expect(payload.settings.locationLabels).toEqual(['AirGradient office', 'Bangkok office'])
  })

  it('rejects duplicate, overlong, and more than twenty labels', async () => {
    const wrapper = await mountSettingsPage()
    await field(wrapper, 'location-label').setValue(' Home office ')
    await wrapper.get('[data-testid="add-location-label"]').trigger('click')
    expect(wrapper.text()).toContain('Location labels must be unique.')

    await field(wrapper, 'location-label').setValue('x'.repeat(101))
    expect(wrapper.text()).toContain('Location labels must be 100 characters or fewer.')

    await wrapper.setProps({
      settings: { ...settings, locationLabels: Array.from({ length: 20 }, (_, index) => `Location ${index + 1}`) }
    })
    await field(wrapper, 'location-label').setValue('Location 21')
    expect(wrapper.get<HTMLButtonElement>('[data-testid="add-location-label"]').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('You can save up to 20 location labels.')
  })

  it('renders server errors as alerts and success status politely', async () => {
    const wrapper = await mountSettingsPage({
      error: 'Could not save settings.',
      status: 'Settings saved.'
    })

    expect(wrapper.get('[role="alert"]').text()).toBe('Could not save settings.')
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(wrapper.get('[role="status"]').text()).toBe('Settings saved.')
  })

  it('focuses the first invalid field when an invalid form is submitted', async () => {
    const wrapper = await mountSettingsPage()
    await field(wrapper, 'display-name').setValue('')

    await wrapper.get('form').trigger('submit')

    expect(document.activeElement).toBe(field(wrapper, 'display-name').element)
  })

  it('discards an unsaved draft when the page is remounted', async () => {
    const first = await mountSettingsPage()
    await field(first, 'display-name').setValue('Unsaved name')
    first.unmount()

    const second = await mountSettingsPage()

    expect(field(second, 'display-name').element.value).toBe('Mog')
    expect(second.get<HTMLButtonElement>('[type="submit"]').element.disabled).toBe(true)
  })
})

async function mountSettingsPage(overrides: Record<string, unknown> = {}) {
  return mountSuspended(SettingsPage, {
    attachTo: document.body,
    props: {
      user,
      settings,
      saving: false,
      error: '',
      status: '',
      ...overrides
    }
  })
}

function field(wrapper: Awaited<ReturnType<typeof mountSettingsPage>>, id: string) {
  return wrapper.get<HTMLInputElement | HTMLSelectElement>(`[data-testid="${id}"]`)
}
