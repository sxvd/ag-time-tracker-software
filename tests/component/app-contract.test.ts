import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAppFixture, mountTrackerApp } from './helpers/app-fixture'

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

const mountedWrappers: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('current frontend behavior contract', () => {
  it('renders the authenticated shell, navigation, timer, and account entry point', async () => {
    const wrapper = await mountContractApp()

    expect(wrapper.text()).toContain('Current Tracking Task')
    expect(wrapper.text()).toContain('Private detail')
    const brand = wrapper.get('.brand')
    expect(brand.get('img.brand-logo').attributes('alt')).toBe('AirGradient')
    expect(brand.get('img.brand-logo').attributes('src')).toMatch(/\/airgradient-logo\.svg$/)
    expect(brand.find('.breezy-crop').exists()).toBe(false)
    expect(brand.text()).toContain('Time Tracker')
    expect(wrapper.find('[aria-haspopup="dialog"]').exists()).toBe(true)
    expect(wrapper.findAll('.nav-item')).toHaveLength(4)
    expect(wrapper.get('.timer-readout').text()).toMatch(/^\d+:\d{2}:\d{2}$/)
    expect(wrapper.text()).toContain('Production readiness review')
    expect(wrapper.text()).toContain('Context switches')
    expect(wrapper.text()).toContain('Task invitation')
    expect(wrapper.text()).toContain('Jack invited you to join')
    expect(wrapper.get('.breezy-panel h2').text()).toBe('Focus in progress')
    expect(wrapper.get('.breezy-panel').text()).not.toContain('Breezy: waving')
    expect(wrapper.find('.timer-panel .breezy-line').exists()).toBe(false)

    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')

    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('Account')
    expect(wrapper.get('[role="dialog"]').text()).toContain('mog@airgradient.com')
    expect(wrapper.get('[role="dialog"]').text()).toContain('System')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Log out')
  })

  it('preserves personal, company, and Work Journey presentation boundaries', async () => {
    const wrapper = await mountContractApp()

    await button(wrapper, 'Personal dashboard').trigger('click')
    expect(wrapper.text()).toContain('Your Dashboard')
    expect(wrapper.text()).toContain('Your hours')
    expect(wrapper.text()).not.toContain('Estimate vs actual')
    expect(wrapper.text()).toContain('Flow State')
    expect(exactButtons(wrapper, 'Export CSV')).toHaveLength(1)
    expect(exactButtons(wrapper, 'New team task')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Raw data')
    expect(wrapper.text()).not.toContain('JSON')
    expect(wrapper.find('a[href*="/api/export"]').exists()).toBe(false)

    await button(wrapper, 'Company dashboard').trigger('click')
    expect(wrapper.text()).toContain('Company Dashboard')
    expect(wrapper.text()).toContain('Aggregated only')
    expect(wrapper.text()).toContain('Company hours')
    expect(wrapper.text()).toContain('Aug 24–30, 2026')
    expect(wrapper.text()).toContain('Work overview')
    expect(wrapper.text()).toContain('Daily tracked time by category')
    expect(wrapper.text()).toContain('1 active shared')
    expect(wrapper.text()).toContain('Work signals')
    expect(wrapper.text()).toContain('Blocker patterns')
    expect(wrapper.text()).not.toContain('Team scope')
    expect(wrapper.text()).not.toContain('Average switches')
    expect(wrapper.text()).not.toContain('Clear review pass.')

    await button(wrapper, 'Work Journey').trigger('click')
    expect(wrapper.text()).toContain('Revisit completed tasks, time spent, and task memories for the selected week.')
    expect(wrapper.text()).toContain('Your completed-task timeline.')
    expect(wrapper.text()).toContain('Each segment = one completed task memory')
    expect(wrapper.findAll('.journey-day-label')).toHaveLength(7)
  })

  it('keeps Account/Settings and task, sharing, manual, feedback, and edit surfaces reachable', async () => {
    const wrapper = await mountContractApp()

    await wrapper.get('[aria-haspopup="dialog"]').trigger('click')
    await wrapper.get('[data-testid="open-settings"]').trigger('click')
    expect(wrapper.text()).toContain('Manage your profile, preferences, and privacy.')
    expect(wrapper.text()).toContain('Activity & Privacy')
    expect(wrapper.text()).toContain('Save changes')

    await button(wrapper, 'Track').trigger('click')
    await button(wrapper, 'New team task').trigger('click')
    expect(wrapper.text()).toContain('Create team task')
    expect(wrapper.find('[aria-label="Task title"]').exists()).toBe(true)
    await wrapper.get('[aria-label="Close create team task"]').trigger('click')

    await button(wrapper, 'Manual entry').trigger('click')
    expect(wrapper.find('[aria-label="Manual task"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Manual start"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Manual end"]').exists()).toBe(true)
    await wrapper.get('[aria-label="Close manual entry"]').trigger('click')

    await button(wrapper, 'Share task').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Share task')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Jack')
    await wrapper.get('[aria-label="Close share task"]').trigger('click')

    await button(wrapper, 'Stop').trigger('click')
    expect(wrapper.text()).toContain('Quick check-in')
    expect(wrapper.text()).toContain('Save feedback')
    expect(wrapper.text()).toContain('Skip')
  })

  it('keeps task entry actions in the page header and explains when to use each workflow', async () => {
    const wrapper = await mountContractApp()

    expect(wrapper.find('.sidebar [aria-label="Quick actions"]').exists()).toBe(false)
    expect(exactButtons(wrapper, 'New team task')).toHaveLength(1)
    expect(exactButtons(wrapper, 'Manual entry')).toHaveLength(1)

    await exactButton(wrapper, 'New team task').trigger('click')
    expect(wrapper.get('form.task-modal').text()).toContain(
      'Choose at least one teammate. The task will appear under Team entries without starting the timer.'
    )
    await wrapper.get('[aria-label="Close create team task"]').trigger('click')

    await exactButton(wrapper, 'Manual entry').trigger('click')
    expect(wrapper.get('form.task-modal').text()).toContain(
      'Log time you already worked without starting the timer.'
    )
  })

  it('renders the existing password sign-in contract when bootstrap is unauthorized', async () => {
    const fetchMock = vi.fn(async () => {
      throw { statusCode: 401 }
    })
    const wrapper = await mountContractApp({ fetchMock })

    expect(wrapper.text()).toContain('Welcome to the time tracker')
    await button(wrapper, 'Sign in').trigger('click')

    expect(wrapper.text()).toContain('Sign in to continue')
    expect(wrapper.get('input[autocomplete="email"]').attributes('placeholder')).toBe('name@airgradient.com')
    expect(wrapper.get('input[autocomplete="current-password"]').attributes('placeholder')).toBe('At least 8 characters')
    expect(wrapper.get('#password-help').text()).toContain('Use at least 8 characters')
    expect(button(wrapper, 'Continue').attributes('type')).toBe('submit')
  })

  it('preserves representative task and timer request contracts', async () => {
    const initial = createAppFixture()
    const paused = createAppFixture({
      entries: initial.entries.map(entry => entry.id === 'entry-active'
        ? {
            ...entry,
            pauses: [
              ...entry.pauses,
              { startedAt: '2026-08-25T04:00:00.000Z', endedAt: null, durationSeconds: null }
            ]
          }
        : entry)
    })
    const fetchMock = vi.fn(async (url: string, options: Record<string, any> = {}) => {
      if (url.endsWith('/api/bootstrap')) return initial
      if (url.endsWith('/api/timer-pause')) return paused
      if (url.endsWith('/api/tasks')) return initial
      throw new Error(`Unexpected request: ${options.method || 'GET'} ${url}`)
    })
    const wrapper = await mountContractApp({ state: initial, fetchMock })

    await wrapper.get('[aria-label="Take a Break"]').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/timer-pause$/),
      expect.objectContaining({
        method: 'POST',
        body: { entryId: 'entry-active' },
        credentials: 'include'
      })
    )

    await button(wrapper, 'New team task').trigger('click')
    await wrapper.get('[aria-label="Task title"]').setValue('Characterized task')
    await wrapper.get('[aria-label="Task description"]').setValue('Preserve this request contract.')
    await wrapper.get('[aria-label="Category"]').setValue('category-deep-work')
    await exactButton(wrapper.get('form.task-modal'), 'Choose teammates').trigger('click')
    const teammate = wrapper.get('form.task-modal').findAll('label').find(label => label.text().includes('Jack'))
    if (!teammate) throw new Error('Jack teammate option not found')
    await teammate.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form.task-modal').trigger('submit')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/tasks$/),
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          title: 'Characterized task',
          description: 'Preserve this request contract.',
          categoryId: 'category-deep-work',
          clientId: 'cl1',
          projectId: 'p1',
          isShared: true,
          members: ['u1', 'u2'],
          requireInvitees: true
        }),
        credentials: 'include'
      })
    )
  })
})

async function mountContractApp(options: Parameters<typeof mountTrackerApp>[0] = {}) {
  const result = await mountTrackerApp(options)
  mountedWrappers.push(result.wrapper)
  return result.wrapper
}

function button(wrapper: VueWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => candidate.text().replace(/\s+/g, ' ').trim().includes(label))
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}

interface FindableWrapper {
  findAll(selector: string): DOMWrapper<Element>[]
}

function exactButtons(wrapper: FindableWrapper, label: string) {
  return wrapper.findAll('button').filter(candidate => candidate.text().replace(/\s+/g, ' ').trim() === label)
}

function exactButton(wrapper: FindableWrapper, label: string) {
  const match = exactButtons(wrapper, label)[0]
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}
