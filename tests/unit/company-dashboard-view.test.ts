import { describe, expect, it } from 'vitest'
import {
  buildCompanyBlockers,
  buildCompanyOverview,
  buildCompanySignal
} from '../../frontend/features/dashboard/company-dashboard-view'
import type { ApiCompanyDashboard } from '../../frontend/types/api'

function createCompanyDashboardFixture(overrides: Partial<ApiCompanyDashboard> = {}): ApiCompanyDashboard {
  return {
    categoryId: null,
    availableCategories: [{ id: 'category-software', name: 'Software' }],
    week: { start: '2026-08-24', end: '2026-08-30', label: 'Aug 24–30, 2026' },
    totalSeconds: 6_600,
    activeSharedSessionCount: 1,
    overview: {
      metric: 'trackedTime',
      groupBy: 'category',
      days: [
        { date: '2026-08-24', label: 'Mon 24', series: [{ name: 'Deep work', value: 4_200 }, { name: 'Meeting', value: 2_400 }] },
        { date: '2026-08-25', label: 'Tue 25', series: [] },
        { date: '2026-08-26', label: 'Wed 26', series: [] },
        { date: '2026-08-27', label: 'Thu 27', series: [] },
        { date: '2026-08-28', label: 'Fri 28', series: [] },
        { date: '2026-08-29', label: 'Sat 29', series: [] },
        { date: '2026-08-30', label: 'Sun 30', series: [] }
      ]
    },
    blockers: [],
    flow: [],
    efficiency: [],
    ...overrides
  }
}

describe('company dashboard presentation', () => {
  it('calculates each recorded signal with its own denominator', () => {
    expect(buildCompanySignal([
      { name: 'Great flow', count: 3 },
      { name: 'Neutral', count: 1 },
      { name: 'Skipped', count: 4 },
      { name: 'Friction', count: 0 }
    ])).toEqual({
      total: 4,
      items: [
        { name: 'Great flow', count: 3, percentage: 75 },
        { name: 'Neutral', count: 1, percentage: 25 }
      ]
    })
  })

  it('builds a Monday-Sunday overview with an explicit metric unit', () => {
    const overview = buildCompanyOverview(createCompanyDashboardFixture())

    expect(overview.labels).toEqual(['Mon 24', 'Tue 25', 'Wed 26', 'Thu 27', 'Fri 28', 'Sat 29', 'Sun 30'])
    expect(overview.title).toBe('Daily tracked time by category')
    expect(overview.unit).toBe('Hours')
    expect(overview.datasets).toEqual([
      expect.objectContaining({ label: 'Deep work', values: [1.17, 0, 0, 0, 0, 0, 0] }),
      expect.objectContaining({ label: 'Meeting', values: [0.67, 0, 0, 0, 0, 0, 0] })
    ])
    expect(overview.description).toContain('Aug 24–30, 2026')
  })

  it('states the recorded-feedback qualification for Flow and Efficiency groupings', () => {
    const dashboard = createCompanyDashboardFixture({
      overview: {
        metric: 'sessions',
        groupBy: 'flow',
        days: [{ date: '2026-08-24', label: 'Mon 24', series: [{ name: 'Great flow', value: 2 }] }]
      }
    })
    const overview = buildCompanyOverview(dashboard)

    expect(overview.title).toBe('Daily work entries by flow')
    expect(overview.unit).toBe('Work entries')
    expect(overview.description).toContain('Recorded feedback only.')
  })

  it('filters and caps blocker rows defensively', () => {
    const blockers = Array.from({ length: 7 }, (_, index) => ({
      name: 'Blocker ' + (index + 1),
      count: index === 6 ? 0 : index + 1,
      hours: index + 1
    }))

    expect(buildCompanyBlockers(blockers).map(item => item.name)).toEqual([
      'Blocker 6',
      'Blocker 5',
      'Blocker 4',
      'Blocker 3',
      'Blocker 2',
      'Blocker 1'
    ])
  })
})
