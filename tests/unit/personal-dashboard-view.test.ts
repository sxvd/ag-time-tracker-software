import { describe, expect, it } from 'vitest'
import type { ApiPersonalDashboard } from '../../frontend/types/api'
import { buildPersonalBlockers, buildPersonalBreakdown, buildPersonalOverview, buildPersonalSignal, buildPersonalTrend, latestPersonalBreezyDay } from '../../frontend/features/dashboard/personal-dashboard-view'
import { buildPersonalWeeks, weeklyTrend } from '../../backend/utils/store'

const dashboard: ApiPersonalDashboard = {
  totalHours: 3,
  totalSeconds: 10800,
  byCategory: [{ name: 'Software', hours: 2, seconds: 7200 }],
  byTask: [{ name: 'Review dashboard', hours: 1.5, seconds: 5400 }],
  blockers: [],
  flow: [
    { name: 'Great flow', count: 3 },
    { name: 'Neutral', count: 1 },
    { name: 'Skipped', count: 2 }
  ],
  efficiency: [],
  energy: [],
  trend: []
}

describe('personal dashboard breakdown presentation', () => {
  it('defaults category and task presentations to tracked hours', () => {
    expect(buildPersonalBreakdown('category', dashboard)).toMatchObject({
      title: 'Hours by category',
      unit: 'Tracked time · hours',
      labels: ['Software'],
      values: [2],
      precision: 1
    })
    expect(buildPersonalBreakdown('task', dashboard)).toMatchObject({
      title: 'Hours by task',
      unit: 'Tracked time · hours',
      labels: ['Review dashboard'],
      values: [1.5],
      precision: 1
    })
  })

  it('uses recorded flow sessions only and includes their percentages', () => {
    expect(buildPersonalBreakdown('flow', dashboard)).toMatchObject({
      title: 'Sessions by flow',
      unit: 'Completed sessions · count and percent',
      labels: ['Great flow (75%)', 'Neutral (25%)'],
      values: [3, 1],
      precision: 0
    })
  })

  it('calculates work-signal percentages from recorded feedback only', () => {
    expect(buildPersonalSignal([
      { name: 'Felt efficient', count: 3 },
      { name: 'Felt manual', count: 1 },
      { name: 'Skipped', count: 4 },
      { name: 'Felt wasteful', count: 0 }
    ])).toEqual({
      total: 4,
      items: [
        { name: 'Felt efficient', count: 3, percentage: 75 },
        { name: 'Felt manual', count: 1, percentage: 25 }
      ]
    })
  })

  it('keeps the latest eight weekly hour buckets in backend order', () => {
    const trend = Array.from({ length: 10 }, (_, index) => ({ name: `Week ${index + 1}`, value: index + 0.5 }))

    expect(buildPersonalTrend(trend)).toMatchObject({
      labels: ['Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8', 'Week 9', 'Week 10'],
      values: [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5],
      description: expect.stringContaining('Week 3 2.5 hours')
    })
  })

  it('provides a weekly-trend empty state', () => {
    expect(buildPersonalTrend([])).toEqual({
      labels: [],
      values: [],
      description: 'No weekly tracked time yet.',
      emptyMessage: 'No weekly tracked time yet.'
    })
  })

  it('rolls shuffled entries into the latest eight weeks in chronological order', () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      startedAt: new Date(Date.UTC(2026, 0, 4 + (index * 7))),
      durationSeconds: (index + 1) * 3600
    })).reverse()

    expect(weeklyTrend(entries)).toEqual([
      { name: 'Jan 18', value: 3 },
      { name: 'Jan 25', value: 4 },
      { name: 'Feb 1', value: 5 },
      { name: 'Feb 8', value: 6 },
      { name: 'Feb 15', value: 7 },
      { name: 'Feb 22', value: 8 },
      { name: 'Mar 1', value: 9 },
      { name: 'Mar 8', value: 10 }
    ])
  })

  it('keeps the four blocker patterns with the most associated time', () => {
    expect(buildPersonalBlockers([
      { name: 'Fourth', count: 8, hours: 1 },
      { name: 'Second', count: 2, hours: 4 },
      { name: 'First', count: 1, hours: 5 },
      { name: 'Third', count: 3, hours: 4 },
      { name: 'Empty', count: 0, hours: 10 }
    ])).toEqual([
      { name: 'First', count: 1, hours: 5 },
      { name: 'Third', count: 3, hours: 4 },
      { name: 'Second', count: 2, hours: 4 },
      { name: 'Fourth', count: 8, hours: 1 }
    ])
  })

  it('builds Monday-to-Sunday dashboard weeks with daily groupings and recorded feedback only', () => {
    const entries = [
      {
        startedAt: new Date('2026-08-31T08:00:00.000Z'),
        durationSeconds: 3600,
        task: { title: 'Build API', category: { name: 'Software' } },
        feedback: { flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High' },
        blockers: [{ blocker: { name: 'Context switching' } }]
      },
      {
        startedAt: new Date('2026-09-02T08:00:00.000Z'),
        durationSeconds: 1800,
        task: { title: 'Review notes', category: { name: 'Communication' } },
        feedback: null,
        blockers: [{ blocker: { name: 'None' } }]
      }
    ]

    expect(buildPersonalWeeks(entries)).toEqual([expect.objectContaining({
      weekStart: '2026-08-31',
      weekEnd: '2026-09-06',
      label: 'Aug 31–Sep 6, 2026',
      totalSeconds: 5400,
      efficiency: [{ name: 'Felt efficient', count: 1 }],
      energy: [{ name: 'High', count: 1 }],
      blockers: [{ name: 'Context switching', count: 1, hours: 1 }],
      days: expect.arrayContaining([
        expect.objectContaining({ label: 'Mon 31', byCategory: [{ name: 'Software', seconds: 3600, sessions: 1, hours: 1 }] }),
        expect.objectContaining({ label: 'Wed 2', byTask: [{ name: 'Review notes', seconds: 1800, sessions: 1, hours: 0.5 }] })
      ])
    })])
  })

  it('builds overview datasets with an adaptive metric-specific unit', () => {
    const week = buildPersonalWeeks([{
      startedAt: new Date('2026-08-31T08:00:00.000Z'),
      durationSeconds: 1800,
      task: { title: 'Build API', category: { name: 'Software' } },
      feedback: { flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High' },
      blockers: []
    }])[0]

    expect(buildPersonalOverview(week, 'time', 'category')).toMatchObject({
      title: 'Daily tracked time by category',
      unit: 'Minutes',
      labels: ['Mon 31', 'Tue 1', 'Wed 2', 'Thu 3', 'Fri 4', 'Sat 5', 'Sun 6'],
      datasets: [{ label: 'Software', values: [30, 0, 0, 0, 0, 0, 0] }],
      precision: 0
    })
    expect(buildPersonalOverview(week, 'sessions', 'flow')).toMatchObject({
      title: 'Daily work entries by flow',
      unit: 'Work entries',
      datasets: [{ label: 'Great flow', values: [1, 0, 0, 0, 0, 0, 0] }],
      precision: 0
    })
  })

  it('uses hours for tracked-time ranges of at least one hour without decimal axis ticks', () => {
    const week = buildPersonalWeeks([{
      startedAt: new Date('2026-08-31T08:00:00.000Z'),
      durationSeconds: 3600,
      task: { title: 'Build API', category: { name: 'Software' } },
      feedback: { flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High' },
      blockers: []
    }])[0]

    expect(buildPersonalOverview(week, 'time', 'category')).toMatchObject({
      title: 'Daily tracked time by category',
      unit: 'Hours',
      datasets: [{ label: 'Software', values: [1, 0, 0, 0, 0, 0, 0] }],
      precision: 0
    })
  })

  it('selects the latest Breezy day by persisted date', () => {
    expect(latestPersonalBreezyDay([
      { date: '2026-08-18', mood: 'happy', airClarityScore: 82, hours: 2, weekLabel: 'August week 3' },
      { date: '2026-09-01', mood: 'cheering', airClarityScore: 91, hours: 3, weekLabel: 'September week 1' },
      { date: '2026-08-25', mood: 'calm', airClarityScore: 78, hours: 1, weekLabel: 'August week 4' }
    ])).toMatchObject({ date: '2026-09-01', mood: 'cheering' })
    expect(latestPersonalBreezyDay([])).toBeNull()
  })
})
