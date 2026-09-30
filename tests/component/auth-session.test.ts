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

  it('renders an accessible mode toggle and emits explicit sign-in credentials', async () => {
    const wrapper = track(await mountSuspended(SignInPanel, {
      props: { restoring: false, error: '' }
    }))

    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Choose account access')
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Sign in')
    expect(wrapper.findAll('form.signin-form')).toHaveLength(1)
    expect(wrapper.get('input[autocomplete="email"]').attributes('placeholder')).toBe('name@airgradient.com')
    expect(wrapper.find('input[autocomplete="name"]').exists()).toBe(false)
    expect(wrapper.find('select[autocomplete="organization-title"]').exists()).toBe(false)
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('placeholder')).toBe('At least 8 characters')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('minlength')).toBe('8')
    expect(wrapper.get('#password-help').text()).toContain('at least 8 characters')

    await wrapper.get('input[autocomplete="email"]').setValue('  mog@airgradient.com  ')
    await wrapper.get('input[autocomplete="current-password"]').setValue('password-123')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{
      email: 'mog@airgradient.com',
      password: 'password-123',
      mode: 'sign-in'
    }]])
  })

  it('switches to registration copy and password semantics', async () => {
    const wrapper = track(await mountSuspended(SignInPanel, {
      props: { restoring: false, error: '', mode: 'register' }
    }))

    expect(wrapper.text()).toContain('Create your account')
    expect(wrapper.get('[role="tab"][aria-selected="true"]').text()).toBe('Register')
    expect(wrapper.get('input[autocomplete="name"]').attributes('placeholder')).toBe('Your name')
    expect(wrapper.findAll('select[autocomplete="organization-title"] option').map(option => option.text())).toEqual([
      'Software', 'Hardware', 'Firmware', 'Communication', 'Research', 'Commerce', 'Production', 'Other'
    ])
    expect(wrapper.get('input[autocomplete="new-password"]').attributes('minlength')).toBe('8')
    expect(wrapper.get('#password-help').text()).toContain('create an account')
    expect(button(wrapper, 'Create account').attributes('type')).toBe('submit')
  })
})

describe('session state', () => {
  const invalidClientCredentials: Array<{
    credentials: Parameters<ReturnType<typeof createSession>['submitAuthentication']>[0]
    message: string
  }> = [
    {
      credentials: { email: 'mog@example.com', password: 'password-123', mode: 'sign-in' },
      message: 'Please use your @airgradient.com email.'
    },
    {
      credentials: { email: 'mog@airgradient.com', password: '', mode: 'sign-in' },
      message: 'Please enter your password.'
    },
    {
      credentials: { email: 'mog@airgradient.com', password: 'password-123', mode: 'register', team: 'Software' },
      message: 'Please enter your name.'
    },
    {
      credentials: { email: 'mog@airgradient.com', password: 'password-123', mode: 'register', displayName: 'Mog' },
      message: 'Please choose your team.'
    }
  ]

  it.each(invalidClientCredentials)('rejects invalid client credentials without calling the session endpoint', async ({ credentials, message }) => {
    const authFetch = vi.fn(async () => createAppFixture())
    const session = createSession({
      authFetch,
      saveTabSessionToken: vi.fn(),
      onAuthenticated: vi.fn(async () => undefined),
      onLogout: vi.fn()
    })

    await session.submitAuthentication(credentials)

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

  it('shows the sign-in form immediately on the signed-out screen', async () => {
    const wrapper = await mountSignedOut()

    expect(wrapper.text()).toContain('Sign in to continue')
    expect(wrapper.get('input[autocomplete="email"]').attributes('placeholder')).toBe('name@airgradient.com')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('placeholder')).toBe('At least 8 characters')
    expect(wrapper.get('#password-help').text()).toContain('existing AirGradient account password')
    expect(wrapper.findAll('form.signin-form')).toHaveLength(1)
  })

  it('accepts a successful existing-user response and persists the application session', async () => {
    const displayName = 'Mog'
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

    const sessionCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/session'))
    expect(sessionCall?.[1]).toMatchObject({
      method: 'POST',
      body: expect.objectContaining({ mode: 'sign-in' })
    })

    expect(wrapper.text()).toContain('Current Tracking Task')
    expect(wrapper.get('.breezy-copy h2').text()).toBe('Focus in progress')
    expect(wrapper.get('.breezy-panel').attributes('aria-live')).toBe('off')
    expect(wrapper.text()).not.toContain(`Welcome back, ${displayName}.`)
    expect(window.sessionStorage.getItem('breezy-tab-session-token')).toBe(`${displayName}-token`)
  })

  it('submits an explicit register intent for a new account', async () => {
    const registered = createAppFixture({
      user: { id: 'u-new', email: 'new.person@airgradient.com', displayName: 'New Person', team: 'Software' },
      sessionToken: 'new-person-token'
    })
    const fetchMock = vi.fn(async (url: string, options: Record<string, unknown> = {}) => {
      if (url.endsWith('/api/bootstrap')) throw { statusCode: 401 }
      if (url.endsWith('/api/session') && options.method === 'POST') return registered
      throw new Error(`Unexpected request: ${String(options.method || 'GET')} ${url}`)
    })
    const wrapper = await mountSignedOut(fetchMock)

    await button(wrapper, 'Register').trigger('click')
    await wrapper.get('input[autocomplete="email"]').setValue(registered.user.email)
    await wrapper.get('input[autocomplete="name"]').setValue(registered.user.displayName)
    await wrapper.get('select[autocomplete="organization-title"]').setValue(registered.user.team)
    await wrapper.get('input[autocomplete="new-password"]').setValue('password-123')
    await wrapper.get('form.signin-form').trigger('submit')
    await flushPromises()

    const sessionCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/session'))
    expect(sessionCall?.[1]).toMatchObject({
      method: 'POST',
      body: {
        email: registered.user.email,
        password: 'password-123',
        mode: 'register',
        displayName: 'New Person',
        team: 'Software'
      }
    })
    expect(wrapper.text()).toContain('Current Tracking Task')
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

    expect(wrapper.text()).toContain('Sign in to continue')
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
