import type { DOMWrapper, VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiState } from '../../frontend/types/api'
import { createAppFixture, createCompanyDashboardFixture, mountTrackerApp, type FixtureFetch } from './helpers/app-fixture'

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
  Bar: {
    props: ['data'],
    template: '<div data-testid="bar-chart">{{ data.labels.join(" | ") }}</div>'
  },
  Line: {
    props: ['data'],
    template: '<div data-testid="line-chart">{{ data.labels.join(" | ") }}</div>'
  }
}))

const mountedWrappers: VueWrapper[] = []

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
  window.sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('personal dashboard and supporting features', () => {
  it('keeps personal metrics in order with authenticated export downloads and medal states', async () => {
    const initial = createAppFixture()
    const exportBlob = new Blob(['entry_id,task\nentry-completed,Private task'], { type: 'text/csv' })
    const fetchMock: FixtureFetch = vi.fn(async (url: string, options?: Record<string, unknown>) => {
      if (url.endsWith('/api/bootstrap')) return clone(initial)
      if (url.endsWith('/api/export?format=csv')) {
        expect(options).toEqual(expect.objectContaining({ responseType: 'blob' }))
        expect((options?.headers as Headers).get('Authorization')).toBe('Bearer fixture-tab-session-token')
        return exportBlob
      }
      throw new Error(`Unexpected request: ${url}`)
    })
    const createObjectUrl = vi.fn(() => 'blob:private-export')
    const revokeObjectUrl = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl })
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    window.sessionStorage.setItem('breezy-tab-session-token', 'fixture-tab-session-token')
    const wrapper = await mountDashboard(initial, fetchMock)

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')

    const hours = wrapper.get('.personal-overview-summary')
    expect(hours.get('h2').text()).toBe('Your hours')
    expect(hours.get('small').text()).toBe('Selected week · Aug 24–30, 2026')
    expect(hours.get('strong').text()).toBe('1 hour 10 minutes')
    expect(wrapper.get('[data-testid="bar-chart"]').text()).toBe('Mon 24 | Tue 25 | Wed 26 | Thu 27 | Fri 28 | Sat 29 | Sun 30')
    expect(wrapper.text()).not.toContain('Top blocker')
    expect(wrapper.text()).not.toContain('AI Insights')
    expect(wrapper.text()).not.toContain('Personal suggestion')

    const overview = wrapper.get('.personal-work-overview-card').element
    const reflectionRail = wrapper.get('.personal-reflection-rail').element
    const medalsCard = wrapper.get('.personal-medals-card').element
    expect(overview.compareDocumentPosition(reflectionRail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(reflectionRail.compareDocumentPosition(medalsCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(medalsCard.parentElement).toBe(reflectionRail)
    expect(reflectionRail.children[0]).toBe(wrapper.get('.personal-signals-card').element)
    expect(reflectionRail.children[1]).toBe(wrapper.get('.personal-blockers-card').element)
    expect(reflectionRail.children[2]).toBe(medalsCard)
    expect(wrapper.find('.personal-export-card').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Raw data')
    expect(exactButton(wrapper, 'Export CSV').exists()).toBe(true)
    expect(wrapper.findAll('button').some(button => normalize(button.text()) === 'New task')).toBe(false)
    await exactButton(wrapper, 'Export CSV').trigger('click')
    await flushPromises()
    expect(createObjectUrl).toHaveBeenCalledWith(exportBlob)
    expect(anchorClick).toHaveBeenCalledOnce()
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:private-export')

    const medalCard = cardWithHeading(wrapper, 'Medals')
    expect(medalCard.findAll('.medal-table thead th').map(cell => cell.text())).toEqual(['Medal', 'Status'])
    const medals = medalCard.findAll('.medal-table-group').map(group => ({
      name: group.get('.medal-primary-row th').text(),
      description: group.get('.medal-meaning-row td').text(),
      state: group.get('.medal-primary-row td').text()
    }))
    expect(medals).toEqual([
      { name: 'Flow State', description: 'Logged a great-flow session.', state: 'Awarded' },
      { name: 'Steady Breeze', description: 'Tracked across five sessions.', state: 'Waiting' }
    ])
  })

  it('switches metric, grouping, chart type, and week locally from one work overview', async () => {
    const wrapper = await mountDashboard()

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')

    const selects = wrapper.findAll<HTMLSelectElement>('.personal-overview-controls select')
    expect(selects[0]!.element.value).toBe('time')
    expect(selects[1]!.element.value).toBe('category')
    expect(wrapper.get('#personal-overview-title').text()).toBe('Daily tracked time by category')
    expect(wrapper.get('.work-overview-chart').attributes('aria-label')).toContain('Hours by day and category')
    expect(wrapper.get('button[aria-label="Previous week"]').find('svg').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="Next week"]').find('svg').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="Bar chart"]').find('svg').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="Line chart"]').find('svg').exists()).toBe(true)

    await selects[1]!.setValue('task')
    expect(wrapper.get('#personal-overview-title').text()).toBe('Daily tracked time by task')
    expect(wrapper.get('.work-overview-chart').attributes('aria-label')).toContain('Production readiness review')

    await selects[0]!.setValue('sessions')
    await selects[1]!.setValue('flow')
    expect(wrapper.get('#personal-overview-title').text()).toBe('Daily work entries by flow')
    expect(wrapper.get('.work-overview-chart').attributes('aria-label')).toContain('Work entries by day and flow')
    expect(wrapper.get('.overview-metric-note').text()).toBe('Work entries count saved timer or manual entries, not hours.')

    await exactButton(wrapper, 'Line').trigger('click')
    expect(wrapper.find('[data-testid="bar-chart"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="line-chart"]').text()).toContain('Mon 24')
  })

  it('does not expose future weeks in the personal week selector', async () => {
    const initial = createAppFixture()
    initial.dashboards.personal.weeks!.push({
      ...initial.dashboards.personal.weeks![0]!,
      weekStart: '2999-01-06',
      weekEnd: '2999-01-12',
      label: 'Jan 6–12, 2999'
    })
    const wrapper = await mountDashboard(initial)

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')

    const weekSelect = wrapper.get<HTMLSelectElement>('select[aria-label="Selected week"]')
    expect([...weekSelect.element.options].map(option => option.text)).not.toContain('Jan 6–12, 2999')
    expect(weekSelect.element.value).not.toBe('2999-01-06')
  })

  it('shows an empty state that follows the selected breakdown view', async () => {
    const initial = createAppFixture()
    initial.dashboards.personal.weeks![0]!.days.forEach((day) => {
      day.byCategory = []
      day.byTask = []
      day.byFlow = []
    })
    const wrapper = await mountDashboard(initial)

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')

    expect(wrapper.get('.dashboard-breakdown-content .empty').text()).toBe('No tracked category data in this week.')
    await wrapper.findAll('.personal-overview-controls select')[1]!.setValue('flow')
    expect(wrapper.get('.dashboard-breakdown-content .empty').text()).toBe('No completed sessions with flow feedback in this week.')
  })

  it('shows efficiency and energy percentages without counting skipped feedback', async () => {
    const initial = createAppFixture()
    initial.dashboards.personal.weeks![0]!.efficiency = [
      { name: 'Felt efficient', count: 3 },
      { name: 'Felt manual', count: 1 },
      { name: 'Skipped', count: 4 }
    ]
    initial.dashboards.personal.weeks![0]!.energy = [
      { name: 'High', count: 1 },
      { name: 'OK', count: 1 },
      { name: 'Skipped', count: 6 }
    ]
    const wrapper = await mountDashboard(initial)

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')

    const card = cardWithHeading(wrapper, 'Work signals')
    expect(card.text()).toContain('How your completed sessions felt this week')
    expect(card.text()).toContain('Felt efficient3 sessions · 75%')
    expect(card.text()).toContain('Felt manual1 session · 25%')
    expect(card.text()).toContain('High1 session · 50%')
    expect(card.text()).toContain('OK1 session · 50%')
    expect(card.text()).not.toContain('Skipped')
    expect(card.text()).toContain('Efficiency4 responses')
    expect(card.text()).toContain('Energy2 responses')
    expect(card.findAll('.work-signal-bar')).toHaveLength(2)
    expect(card.findAll('.personal-signal-legend')).toHaveLength(2)
    expect(card.find('.work-signal-list').exists()).toBe(false)
  })

  it('shows calm empty states when no work-signal feedback was recorded', async () => {
    const initial = createAppFixture()
    initial.dashboards.personal.weeks![0]!.efficiency = [{ name: 'Skipped', count: 3 }]
    initial.dashboards.personal.weeks![0]!.energy = []
    const wrapper = await mountDashboard(initial)

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')

    const card = cardWithHeading(wrapper, 'Work signals')
    expect(card.text()).toContain('No efficiency feedback recorded yet.')
    expect(card.text()).toContain('No energy feedback recorded yet.')
    expect(card.text()).not.toContain('Skipped')
  })

  it('removes duplicate weekly trend and Breezy-day summary cards', async () => {
    const wrapper = await mountDashboard()
    await navigationButton(wrapper, 'Personal dashboard').trigger('click')
    expect(wrapper.text()).not.toContain('Weekly trend')
    expect(wrapper.text()).not.toContain('Breezy day')
  })

  it('shows the top four blocker patterns for the selected week', async () => {
    const initial = createAppFixture()
    initial.dashboards.personal.weeks![0]!.blockers = [
      { name: 'Fourth blocker', count: 5, hours: 1 },
      { name: 'Waiting on someone', count: 3, hours: 4.5 },
      { name: 'Context switching', count: 2, hours: 3.2 },
      { name: 'Unclear requirements', count: 1, hours: 2.1 }
    ]
    const wrapper = await mountDashboard(initial)

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')

    const card = cardWithHeading(wrapper, 'Blocker patterns')
    expect(card.text()).toContain('Affected sessions · associated tracked time')
    expect(card.findAll('li').map(item => item.text())).toEqual([
      'Waiting on someone3 sessions · 4.5h',
      'Context switching2 sessions · 3.2h',
      'Unclear requirements1 session · 2.1h',
      'Fourth blocker5 sessions · 1h'
    ])
  })

  it('shows a neutral empty state when no blockers were logged', async () => {
    const initial = createAppFixture()
    initial.dashboards.personal.weeks![0]!.blockers = []
    const wrapper = await mountDashboard(initial)

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')

    const card = cardWithHeading(wrapper, 'Blocker patterns')
    expect(card.get('.empty').text()).toBe('Clear skies — no blockers logged.')
  })

  it('opens the owned-entry editor from entry history without exposing edit controls for another user', async () => {
    const wrapper = await mountDashboard()

    const editButtons = wrapper.findAll('button[aria-label^="Edit "]')
    expect(editButtons.map(button => button.attributes('aria-label'))).toEqual([
      'Edit Production readiness review entry'
    ])

    await editButtons[0]!.trigger('click')

    const editor = wrapper.get('form.entry-edit-modal[role="dialog"]')
    expect(editor.get('h2').text()).toBe('Edit time entry')
    expect(editor.get<HTMLSelectElement>('select').element.value).toBe('task-active')
  })

  it('keeps CSV export failures beside the header action instead of sending technical copy through Breezy', async () => {
    const initial = createAppFixture()
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return clone(initial)
      if (url.endsWith('/api/export?format=csv')) throw new Error('private storage detail')
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountDashboard(initial, fetchMock)

    await navigationButton(wrapper, 'Personal dashboard').trigger('click')
    await exactButton(wrapper, 'Export CSV').trigger('click')
    await flushPromises()

    expect(wrapper.get('.topbar-r .form-error').text()).toBe('Could not download your raw data. Please try again.')
    expect(wrapper.get('.topbar-r').text()).not.toContain('private storage detail')
  })

  it('renders entry history with visible data headers and an icon-only edit control', async () => {
    const wrapper = await mountDashboard()
    const history = wrapper.get('.sessions-panel')

    expect(history.get('table').attributes('aria-label')).toBe("Today's individual entries")
    expect(history.findAll('thead th:not(.entry-controls-heading)').map(header => header.text())).toEqual([
      'Task',
      'Time spent',
      'Start → Finish',
      'Feeling'
    ])
    expect(history.get('thead th.entry-controls-heading').text()).toBe('Entry controls')
    expect(history.get('tbody').text()).not.toContain('Time spent')
    expect(history.get('tbody').text()).not.toContain('Feeling')
    expect(history.get('tbody th[scope="row"]').text()).toBe('Production readiness review')
    expect(history.get('tbody').text()).toContain('Great flow / Felt efficient / High')
    const editButton = history.get('button[aria-label="Edit Production readiness review entry"]')
    expect(editButton.text()).toBe('')
    expect(editButton.attributes('title')).toBe('Edit entry')
    expect(editButton.get('svg').attributes('aria-hidden')).toBe('true')
    expect(history.find('[aria-label^="Delete "]').exists()).toBe(false)

    await exactButton(history, 'Team').trigger('click')

    expect(history.get('table').attributes('aria-label')).toBe("Today's team entries")
    expect(history.findAll('thead th').map(header => header.text())).toEqual([
      'Task',
      'Members',
      'My time spent',
      'Team task controls'
    ])
  })

})

describe('company Work overview', () => {
  it('loads aggregate-only data and refreshes the selected category scope', async () => {
    const initial = createAppFixture()
    const all = createCompanyDashboardFixture()
    const software = createCompanyDashboardFixture({
      categoryId: 'category-deep-work',
      totalSeconds: 4_200,
      activeSharedSessionCount: 2,
      overview: {
        metric: 'trackedTime',
        groupBy: 'category',
        days: [{ date: '2026-08-24', label: 'Mon 24', series: [{ name: 'Deep work', value: 4_200 }] }]
      }
    })
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return clone(initial)
      if (url.includes('/api/company-dashboard') && url.includes('categoryId=category-deep-work')) return clone(software)
      if (url.includes('/api/company-dashboard')) return clone(all)
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountDashboard(initial, fetchMock)

    await navigationButton(wrapper, 'Company dashboard').trigger('click')
    await flushPromises()

    expect(wrapper.get('.company-dashboard-grid').text()).toContain('Company hours')
    expect(wrapper.get('.company-dashboard-grid').text()).toContain('Work overview')
    expect(wrapper.get('.company-dashboard-grid').text()).not.toMatch(/Team scope|Aggregated category time|Average switches/i)
    const mainCard = wrapper.get('.company-main-card')
    const sideColumn = wrapper.get('.company-side-column')
    expect(mainCard.find('.company-overview-section').exists()).toBe(true)
    expect(mainCard.find('.company-main-divider').exists()).toBe(true)
    expect(mainCard.find('.company-work-overview-section').exists()).toBe(true)
    expect(sideColumn.classes()).not.toContain('card')
    expect(sideColumn.find('.company-active-card').exists()).toBe(true)
    expect(sideColumn.find('.work-signals-card').exists()).toBe(true)
    expect(sideColumn.find('.blocker-patterns-card').exists()).toBe(true)
    expect(sideColumn.find('.company-reflection-divider').exists()).toBe(false)
    expect(wrapper.find('.company-overview-card').exists()).toBe(false)
    expect(wrapper.find('.company-work-overview-card').exists()).toBe(false)
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/company-dashboard?metric=trackedTime&groupBy=category'))).toBe(true)

    await wrapper.get('#company-category-filter').setValue('category-deep-work')
    await flushPromises()

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('categoryId=category-deep-work'))).toBe(true)
    expect(wrapper.get('.company-hours-summary strong').text()).toBe('1 hour 10 minutes')
    expect(wrapper.get('.company-hours-heading').text()).toMatch(/^Company hours· Aug 24/)
    expect(wrapper.get('.company-active-card').text()).toContain('2 active sharedsessions')
    expect(wrapper.get('.company-dashboard-grid').text()).not.toMatch(/Production readiness review|task-active|Home office|Mog/i)
    expect(wrapper.findAll('button').some(button => normalize(button.text()) === 'New task')).toBe(false)
  })

  it('disables next-week navigation on the current company dashboard week', async () => {
    const initial = createAppFixture()
    const currentStart = currentWeekStartKey()
    const current = createCompanyDashboardFixture({
      week: {
        start: currentStart,
        end: addDaysKey(currentStart, 6),
        label: `${currentStart} current week`
      }
    })
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return clone(initial)
      if (url.includes('/api/company-dashboard')) return clone(current)
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountDashboard(initial, fetchMock)

    await navigationButton(wrapper, 'Company dashboard').trigger('click')
    await flushPromises()

    expect(wrapper.get('button[aria-label="Next week"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').some(button => normalize(button.text()) === 'New task')).toBe(false)
  })

  it('falls back to all categories when a selected category was deleted', async () => {
    const initial = createAppFixture()
    const all = createCompanyDashboardFixture()
    const fetchMock: FixtureFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/api/bootstrap')) return clone(initial)
      if (url.includes('categoryId=category-deep-work')) {
        throw { statusCode: 400, statusMessage: 'Select an available category.' }
      }
      if (url.includes('/api/company-dashboard')) return clone(all)
      throw new Error(`Unexpected request: ${url}`)
    })
    const wrapper = await mountDashboard(initial, fetchMock)

    await navigationButton(wrapper, 'Company dashboard').trigger('click')
    await flushPromises()
    await wrapper.get('#company-category-filter').setValue('category-deep-work')
    await flushPromises()

    expect((wrapper.get('#company-category-filter').element as HTMLSelectElement).value).toBe('')
    expect(wrapper.get('[role="alert"]').text()).toContain('no longer available')
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/company-dashboard')).length).toBe(3)
  })
})

async function mountDashboard(state = createAppFixture(), fetchMock?: FixtureFetch) {
  const result = await mountTrackerApp({ state, fetchMock })
  mountedWrappers.push(result.wrapper)
  return result.wrapper
}

interface FindableWrapper {
  findAll(selector: string): DOMWrapper<Element>[]
}

function exactButton(wrapper: FindableWrapper, label: string) {
  const match = wrapper.findAll('button').find(candidate => normalize(candidate.text()) === label)
  if (!match) throw new Error(`Button not found: ${label}`)
  return match
}

function navigationButton(wrapper: FindableWrapper, label: string) {
  const match = wrapper.findAll('.nav-item').find(candidate => normalize(candidate.text()).endsWith(label))
  if (!match) throw new Error(`Navigation button not found: ${label}`)
  return match
}

function cardWithHeading(wrapper: VueWrapper, heading: string) {
  const match = wrapper.findAll('.dashboard-grid article').find((card) => {
    const candidate = card.find('h2')
    const metricLabel = card.find('span')
    return (candidate.exists() && normalize(candidate.text()) === heading)
      || (metricLabel.exists() && normalize(metricLabel.text()) === heading)
  })
  if (!match) throw new Error(`Card not found: ${heading}`)
  return match
}

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function currentWeekStartKey() {
  const date = new Date()
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const mondayOffset = (utc.getUTCDay() + 6) % 7
  utc.setUTCDate(utc.getUTCDate() - mondayOffset)
  return utc.toISOString().slice(0, 10)
}

function addDaysKey(key: string, days: number) {
  const date = new Date(`${key}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
