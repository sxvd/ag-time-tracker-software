import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../frontend/app.vue'
import SignInPanel from '../../frontend/features/auth/SignInPanel.vue'
import { createSession } from '../../frontend/features/auth/useSession'
import { createAppFixture } from './helpers/app-fixture'

vi.mock('chart.js', () => ({
  BarElement: {},
  CategoryScale: {},
  Chart: { register: vi.fn() },
  Legend: {},
  LinearScale: {},
  LineElement: {},
  PointElement: {},
  Tooltip: {}
}))

vi.mock('vue-chartjs', () => ({
  Bar: { template: '<div data-testid="bar-chart"></div>' },
  Line: { template: '<div data-testid="line-chart"></div>' }
}))

const wrappers: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SignInPanel', () => {
  it('renders restoration without exposing the password form', async () => {
    const wrapper = track(await mountSuspended(SignInPanel, { props: { restoring: true } }))

    expect(wrapper.text()).toContain('Restoring workspace')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('opens one labelled password form and emits trimmed credentials', async () => {
    const wrapper = track(await mountSuspended(SignInPanel, {
      props: { restoring: false, showForm: true, error: '' }
    }))

    expect(wrapper.findAll('form.signin-form')).toHaveLength(1)
    expect(wrapper.get('input[autocomplete="email"]').attributes('placeholder')).toBe('name@airgradient.com')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('placeholder')).toBe('At least 8 characters')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('minlength')).toBe('8')
    expect(wrapper.get('#password-help').text()).toContain('Use at least 8 characters')

    await wrapper.get('input[autocomplete="email"]').setValue('  mog@airgradient.com  ')
    await wrapper.get('input[autocomplete="current-password"]').setValue('password-123')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{
      email: 'mog@airgradient.com',
      password: 'password-123'
    }]])
  })
})

describe('session state', () => {
  it.each([
    ['mog@example.com', 'password-123', 'Please use your @airgradient.com email.'],
    ['mog@airgradient.com', '', 'Please enter your password.']
  ])('rejects invalid client credentials without calling the session endpoint', async (email, password, message) => {
    const authFetch = vi.fn(async () => createAppFixture())
    const session = createSession({
      authFetch,
      saveTabSessionToken: vi.fn(),
      onAuthenticated: vi.fn(async () => undefined),
      onLogout: vi.fn()
    })

    await session.submitSignIn({ email, password })

    expect(session.signInError.value).toBe(message)
    expect(authFetch).not.toHaveBeenCalled()
  })
})

describe('password session transitions', () => {
  it('shows restoration before bootstrap settles, then restores the authenticated shell', async () => {
    let resolveBootstrap!: (state: ReturnType<typeof createAppFixture>) => void
    const bootstrap = new Promise<ReturnType<typeof createAppFixture>>((resolve) => { resolveBootstrap = resolve })
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return bootstrap
      throw new Error(`Unexpected request: ${url}`)
    }))

    const wrapper = track(await mountSuspended(App, { attachTo: document.body }))
    expect(wrapper.text()).toContain('Restoring workspace')

    resolveBootstrap(createAppFixture())
    await flushPromises()
    expect(wrapper.text()).toContain('Current Tracking Task')
  })

  it('does not start timer or activity resources when delayed restoration finishes after unmount', async () => {
    let resolveBootstrap!: (state: ReturnType<typeof createAppFixture>) => void
    const bootstrap = new Promise<ReturnType<typeof createAppFixture>>((resolve) => { resolveBootstrap = resolve })
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return bootstrap
      throw new Error(`Unexpected request: ${url}`)
    }))
    const wrapper = await mountSuspended(App, { attachTo: document.body })
    expect(wrapper.text()).toContain('Restoring workspace')

    wrapper.unmount()
    const documentAdd = vi.spyOn(document, 'addEventListener')
    const windowAdd = vi.spyOn(window, 'addEventListener')
    const interval = vi.spyOn(globalThis, 'setInterval').mockImplementation(() => 1 as unknown as ReturnType<typeof setInterval>)
    resolveBootstrap(createAppFixture())
    await flushPromises()

    expect(documentAdd.mock.calls.some(([type]) => type === 'visibilitychange')).toBe(false)
    expect(windowAdd.mock.calls.some(([type]) => String(type) === 'mousemove' || String(type) === 'keydown')).toBe(false)
    expect(interval).not.toHaveBeenCalled()
  })

  it('opens the single password form with the existing field contract', async () => {
    const wrapper = await mountSignedOut()

    expect(wrapper.text()).toContain('Welcome to the time tracker')
    await button(wrapper, 'Sign in').trigger('click')

    expect(wrapper.text()).toContain('Sign in to continue')
    expect(wrapper.get('input[autocomplete="email"]').attributes('placeholder')).toBe('name@airgradient.com')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('placeholder')).toBe('At least 8 characters')
    expect(wrapper.get('#password-help').text()).toContain('New AirGradient work emails will create an account automatically.')
    expect(wrapper.findAll('form.signin-form')).toHaveLength(1)
  })

  it.each([
    ['existing user', 'Mog'],
    ['automatically registered user', 'New Person']
  ])('accepts a successful %s password response and persists the application session', async (_case, displayName) => {
    const signedIn = createAppFixture({
      user: { id: 'u1', email: `${displayName.toLowerCase().replace(' ', '.')}@airgradient.com`, displayName, team: 'Software' },
      sessionToken: `${displayName}-token`
    })
    const fetchMock = vi.fn(async (url: string, options: Record<string, unknown> = {}) => {
      if (url.endsWith('/api/bootstrap')) throw { statusCode: 401 }
      if (url.endsWith('/api/session') && options.method === 'POST') return signedIn
      throw new Error(`Unexpected request: ${String(options.method || 'GET')} ${url}`)
    })
    const wrapper = await mountSignedOut(fetchMock)
    await signIn(wrapper, signedIn.user.email, 'password-123')

    expect(wrapper.text()).toContain('Current Tracking Task')
    expect(wrapper.get('.breezy-copy h2').text()).toBe('Focus in progress')
    expect(wrapper.get('.breezy-panel').attributes('aria-live')).toBe('off')
    expect(wrapper.text()).not.toContain(`Welcome back, ${displayName}.`)
    expect(window.sessionStorage.getItem('breezy-tab-session-token')).toBe(`${displayName}-token`)
  })

  it('keeps the password form open and presents the authoritative sign-in failure', async () => {
    const fetchMock = vi.fn(async (url: string, options: Record<string, unknown> = {}) => {
      if (url.endsWith('/api/bootstrap')) throw { statusCode: 401 }
      if (url.endsWith('/api/session') && options.method === 'POST') {
        throw { data: { statusMessage: 'Invalid email or password.' } }
      }
      throw new Error(`Unexpected request: ${String(options.method || 'GET')} ${url}`)
    })
    const wrapper = await mountSignedOut(fetchMock)
    await signIn(wrapper, 'mog@airgradient.com', 'wrong-password')

    expect(wrapper.get('.form-error').text()).toBe('Invalid email or password.')
    expect(wrapper.find('form.signin-form').exists()).toBe(true)
  })

  it('restores a refreshed tab with its bearer token and logs out to a clean default session', async () => {
    window.sessionStorage.setItem('breezy-tab-session-token', 'refresh-token')
    const state = createAppFixture()
    const fetchMock = vi.fn(async (url: string, options: Record<string, unknown> = {}) => {
      if (url.endsWith('/api/bootstrap')) return state
      if (url.endsWith('/api/session') && options.method === 'DELETE') return undefined
      throw new Error(`Unexpected request: ${String(options.method || 'GET')} ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)
    const wrapper = track(await mountSuspended(App, { attachTo: document.body }))
    await flushPromises()

    const bootstrapCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/bootstrap'))
    expect((bootstrapCall?.[1]?.headers as Headers).get('Authorization')).toBe('Bearer refresh-token')

    await button(wrapper, 'Company dashboard').trigger('click')
    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')
    await button(wrapper, 'Log out').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Welcome to the time tracker')
    expect(wrapper.text()).not.toContain('Company Dashboard')
    expect(window.sessionStorage.getItem('breezy-tab-session-token')).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/session$/),
      expect.objectContaining({ method: 'DELETE', credentials: 'include' })
    )
  })
})

describe('application destination transitions', () => {
  it('keeps labels, ordering, active destination, and page metadata stable', async () => {
    const state = createAppFixture()
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return state
      throw new Error(`Unexpected request: ${url}`)
    }))
    const wrapper = track(await mountSuspended(App, { attachTo: document.body }))
    await flushPromises()

    expect(wrapper.findAll('nav[aria-label="Main sections"] .nav-item').map(item => item.text().replace(/\s+/g, ' ').trim())).toEqual([
      'T Track Live',
      'P Personal dashboard',
      'C Company dashboard',
      'J Work Journey'
    ])

    await assertDestination(wrapper, 'Personal dashboard', 'Your Dashboard', 'Personal - private', 'personal')
    await assertDestination(wrapper, 'Company dashboard', 'Company Dashboard', 'Aggregated - process', 'company')
    await assertDestination(wrapper, 'Work Journey', 'Work Journey', 'Personal - private', 'journey')

    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')
    await button(wrapper, 'Settings').trigger('click')
    expect(wrapper.get('h1').text()).toBe('Settings')
    expect(wrapper.get('.topbar .eyebrow').text()).toBe('Account - private')

    await assertDestination(wrapper, 'Track', 'Current Tracking Task', 'Personal - private', 'track')
  })
})

async function mountSignedOut(fetchMock = vi.fn(async () => { throw { statusCode: 401 } })) {
  vi.stubGlobal('$fetch', fetchMock)
  const wrapper = track(await mountSuspended(App, { attachTo: document.body }))
  await flushPromises()
  return wrapper
}

async function signIn(wrapper: VueWrapper, email: string, password: string) {
  await button(wrapper, 'Sign in').trigger('click')
  await wrapper.get('input[autocomplete="email"]').setValue(email)
  await wrapper.get('input[autocomplete="current-password"]').setValue(password)
  await wrapper.get('form.signin-form').trigger('submit')
  await flushPromises()
}

async function assertDestination(wrapper: VueWrapper, label: string, heading: string, eyebrow: string, pageKey: string) {
  await button(wrapper, label).trigger('click')
  expect(wrapper.get('h1').text()).toBe(heading)
  expect(wrapper.get('.topbar .eyebrow').text()).toBe(eyebrow)
  expect(wrapper.get(`.nav-item.active`).classes()).toContain('active')
  expect(wrapper.get(`.nav-item.active`).text().toLowerCase()).toContain(pageKey === 'journey' ? 'journey' : pageKey)
}

function button(wrapper: VueWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => candidate.text().replace(/\s+/g, ' ').trim().includes(label))
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}

function track<T extends VueWrapper>(wrapper: T) {
  wrappers.push(wrapper)
  return wrapper
}
