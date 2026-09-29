import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../frontend/app.vue'

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('account settings shell integration', () => {
  it('opens Settings from the account menu and saves through the atomic endpoint', async () => {
    const initial = apiState()
    const updated = apiState({ displayName: 'Mog Updated' })
    const fetchMock = vi.fn(async (url: string, options: any = {}) => {
      if (url.endsWith('/api/account-settings') && options.method === 'PATCH') return updated
      if (url.endsWith('/api/bootstrap')) return initial
      throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const wrapper = await mountSuspended(App, { attachTo: document.body })
    await flushPromises()

    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')
    await wrapper.get('[data-testid="open-settings"]').trigger('click')
    await wrapper.get('[data-testid="display-name"]').setValue('Mog Updated')
    await wrapper.get('form.settings-page').trigger('submit')
    await flushPromises()

    const patchCall = fetchMock.mock.calls.find(([url, options]) => (
      String(url).endsWith('/api/account-settings') && options?.method === 'PATCH'
    ))
    expect(patchCall?.[1]?.body).toEqual({
      profile: { displayName: 'Mog Updated', team: 'Software' },
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
    expect(wrapper.get('[role="status"]').text()).toBe('Settings saved.')
    expect(wrapper.text()).toContain('Mog Updated')
  })

  it('preserves the draft and shows an authoritative validation failure', async () => {
    const fetchMock = vi.fn(async (url: string, options: any = {}) => {
      if (url.endsWith('/api/account-settings') && options.method === 'PATCH') {
        throw { statusCode: 400, data: { statusMessage: 'Display name is required.' } }
      }
      if (url.endsWith('/api/bootstrap')) return apiState()
      throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = await openSettingsPage()

    await wrapper.get('[data-testid="display-name"]').setValue('Mog Updated')
    await wrapper.get('form.settings-page').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('Display name is required.')
    expect(wrapper.get<HTMLInputElement>('[data-testid="display-name"]').element.value).toBe('Mog Updated')
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/bootstrap'))).toHaveLength(1)
  })

  it('reconciles an unknown failure without retrying the mutation', async () => {
    const fetchMock = vi.fn(async (url: string, options: any = {}) => {
      if (url.endsWith('/api/account-settings') && options.method === 'PATCH') throw new Error('connection closed')
      if (url.endsWith('/api/bootstrap')) return apiState()
      throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = await openSettingsPage()

    await wrapper.get('[data-testid="display-name"]').setValue('Mog Updated')
    await wrapper.get('form.settings-page').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'Could not confirm whether settings were saved. Refresh and check before trying again.'
    )
    expect(wrapper.get<HTMLInputElement>('[data-testid="display-name"]').element.value).toBe('Mog Updated')
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/account-settings'))).toHaveLength(1)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/bootstrap'))).toHaveLength(2)
  })

  it('reports success when reconciliation confirms the transaction committed', async () => {
    let bootstrapCalls = 0
    const fetchMock = vi.fn(async (url: string, options: any = {}) => {
      if (url.endsWith('/api/account-settings') && options.method === 'PATCH') throw new Error('connection closed')
      if (url.endsWith('/api/bootstrap')) {
        bootstrapCalls += 1
        return bootstrapCalls === 1 ? apiState() : apiState({ displayName: 'Mog Updated' })
      }
      throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = await openSettingsPage()

    await wrapper.get('[data-testid="display-name"]').setValue('Mog Updated')
    await wrapper.get('form.settings-page').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toBe('Settings saved.')
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/account-settings'))).toHaveLength(1)
  })
})

async function openSettingsPage() {
  const wrapper = await mountSuspended(App, { attachTo: document.body })
  await flushPromises()
  await wrapper.get('[aria-haspopup="dialog"]').trigger('click')
  await wrapper.get('[data-testid="open-settings"]').trigger('click')
  return wrapper
}

function apiState(userOverrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'u1',
      email: 'mog@airgradient.com',
      displayName: 'Mog',
      team: 'Software',
      ...userOverrides
    },
    users: [{ id: 'u1', displayName: 'Mog', team: 'Software' }],
    signedInUsers: [{ id: 'u1', displayName: 'Mog', team: 'Software' }],
    taskInvitations: [],
    categories: [{ id: 'c1', name: 'Deep work' }],
    clients: [],
    projects: [],
    blockers: ['None'],
    tasks: [],
    entries: [],
    sharedTaskEffort: [],
    settings: {
      idleThresholdMinutes: 5,
      nudgeCadenceMinutes: 50,
      breezyVerbosity: 'gentle',
      muted: false,
      locationEnabled: false,
      activityEnabled: true,
      locationLabels: ['Home office', 'AirGradient office']
    },
    dashboards: {
      personal: { totalHours: 0, totalSeconds: 0, flow: [], blockers: [], byCategory: [] }
    },
    journey: [],
    medals: []
  }
}
