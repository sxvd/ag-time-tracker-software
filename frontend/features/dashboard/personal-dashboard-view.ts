import type { ApiJourneyDay, ApiPersonalDashboard, ApiPersonalDashboardWeek } from '~/types/api'

export type PersonalBreakdownView = 'category' | 'task' | 'flow'
export type PersonalOverviewMetric = 'time' | 'sessions'
export type PersonalOverviewChartType = 'bar' | 'line'

export const personalBreakdownOptions: ReadonlyArray<{ value: PersonalBreakdownView, label: string }> = [
  { value: 'category', label: 'Category' },
  { value: 'task', label: 'Task' },
  { value: 'flow', label: 'Flow' }
]

export interface PersonalBreakdownPresentation {
  title: string
  unit: string
  datasetLabel: string
  labels: string[]
  values: number[]
  description: string
  emptyMessage: string
  precision: number
}

export interface PersonalSignalItem {
  name: string
  count: number
  percentage: number
}

export interface PersonalSignalPresentation {
  items: PersonalSignalItem[]
  total: number
}

export interface PersonalTrendPresentation {
  labels: string[]
  values: number[]
  description: string
  emptyMessage: string
}

export interface PersonalOverviewDataset {
  label: string
  values: number[]
  color: string
}

export interface PersonalOverviewPresentation {
  title: string
  unit: 'Minutes' | 'Hours' | 'Work entries'
  labels: string[]
  datasets: PersonalOverviewDataset[]
  description: string
  emptyMessage: string
  precision: number
  insight: string
}

const overviewColors = ['#1c75bc', '#50a9ee', '#20aaa6', '#fc7e10', '#7d73d7', '#38a169', '#d69e2e', '#718096']

export function buildPersonalOverview(
  week: ApiPersonalDashboardWeek | undefined,
  metric: PersonalOverviewMetric,
  grouping: PersonalBreakdownView
): PersonalOverviewPresentation {
  const groupLabel = grouping === 'category' ? 'category' : grouping
  const emptyMessage = grouping === 'flow'
    ? 'No completed sessions with flow feedback in this week.'
    : `No tracked ${groupLabel} data in this week.`
  const labels = week?.days.map(day => day.label) || []
  const field = grouping === 'category' ? 'byCategory' : grouping === 'task' ? 'byTask' : 'byFlow'
  const dailySecondsTotals = (week?.days || []).map(day => day[field].reduce((sum, item) => sum + item.seconds, 0))
  const useMinutes = metric === 'time' && dailySecondsTotals.some(Boolean) && Math.max(...dailySecondsTotals) < 3_600
  const unit = metric === 'time'
    ? useMinutes ? 'Minutes' : 'Hours'
    : 'Work entries'
  const names = new Set<string>()
  for (const day of week?.days || []) for (const item of day[field]) names.add(item.name)
  const sortedNames = [...names].sort((left, right) => {
    const total = (name: string) => (week?.days || []).reduce((sum, day) => {
      const item = day[field].find(candidate => candidate.name === name)
      return sum + (metric === 'time' ? item?.seconds || 0 : item?.sessions || 0)
    }, 0)
    return total(right) - total(left) || left.localeCompare(right)
  })
  const datasets = sortedNames.map((name, index) => ({
    label: name,
    color: overviewColors[index % overviewColors.length]!,
    values: (week?.days || []).map(day => {
      const item = day[field].find(candidate => candidate.name === name)
      if (metric === 'sessions') return item?.sessions || 0
      const seconds = item?.seconds || 0
      return useMinutes ? Math.round(seconds / 60) : Math.round((seconds / 3600) * 100) / 100
    })
  }))
  const dailyTotals = labels.map((_, index) => datasets.reduce((sum, dataset) => sum + dataset.values[index]!, 0))
  const topDataset = datasets[0]
  const topDayIndex = dailyTotals.reduce((best, value, index) => value > (dailyTotals[best] || 0) ? index : best, 0)
  const insight = topDataset
    ? `${topDataset.label} had the highest ${metric === 'time' ? 'tracked time' : 'work-entry count'}; ${labels[topDayIndex]} had the highest daily total.`
    : emptyMessage
  const summary = datasets.map(dataset => `${dataset.label}: ${dataset.values.join(', ')} ${unit.toLowerCase()}`).join('; ')

  return {
    title: `Daily ${metric === 'time' ? 'tracked time' : 'work entries'} by ${groupLabel}`,
    unit,
    labels,
    datasets,
    description: summary ? `${unit} by day and ${groupLabel}: ${summary}.` : emptyMessage,
    emptyMessage,
    precision: 0,
    insight
  }
}

export function buildPersonalBlockers(items: ApiPersonalDashboard['blockers']) {
  return [...items]
    .filter(item => item.count > 0)
    .sort((left, right) => right.hours - left.hours || right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 4)
}

export function latestPersonalBreezyDay(items: ApiJourneyDay[]): ApiJourneyDay | null {
  return [...items].sort((left, right) => right.date.localeCompare(left.date))[0] || null
}

export function buildPersonalTrend(items: ApiPersonalDashboard['trend']): PersonalTrendPresentation {
  const recent = items.slice(-8)
  const summary = recent.map(item => `${item.name} ${item.value} hours`).join('; ')
  const emptyMessage = 'No weekly tracked time yet.'

  return {
    labels: recent.map(item => item.name),
    values: recent.map(item => item.value),
    description: summary ? `Weekly tracked hours: ${summary}.` : emptyMessage,
    emptyMessage
  }
}

export function buildPersonalSignal(items: ApiPersonalDashboard['efficiency']): PersonalSignalPresentation {
  const recorded = items.filter(item => item.name !== 'Skipped' && item.count > 0)
  const total = recorded.reduce((sum, item) => sum + item.count, 0)

  return {
    items: recorded.map(item => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
    })),
    total
  }
}

export function buildPersonalBreakdown(
  view: PersonalBreakdownView,
  dashboard: ApiPersonalDashboard
): PersonalBreakdownPresentation {
  if (view === 'task') {
    return buildHoursPresentation(
      'Hours by task',
      'task',
      dashboard.byTask,
      'No tracked task time yet.'
    )
  }

  if (view === 'flow') {
    const recorded = dashboard.flow.filter(item => item.name !== 'Skipped')
    const total = recorded.reduce((sum, item) => sum + item.count, 0)
    const percentages = recorded.map(item => total > 0 ? Math.round((item.count / total) * 100) : 0)
    const labels = recorded.map((item, index) => `${item.name} (${percentages[index]}%)`)
    const values = recorded.map(item => item.count)
    const summary = recorded.map((item, index) => `${item.name} ${item.count} ${item.count === 1 ? 'session' : 'sessions'}, ${percentages[index]} percent`).join('; ')

    return {
      title: 'Sessions by flow',
      unit: 'Completed sessions · count and percent',
      datasetLabel: 'Sessions',
      labels,
      values,
      description: summary ? `Completed sessions by flow: ${summary}.` : 'No completed sessions with flow feedback yet.',
      emptyMessage: 'No completed sessions with flow feedback yet.',
      precision: 0
    }
  }

  return buildHoursPresentation(
    'Hours by category',
    'category',
    dashboard.byCategory,
    'No tracked category time yet.'
  )
}

function buildHoursPresentation(
  title: string,
  grouping: 'category' | 'task',
  items: ApiPersonalDashboard['byCategory'],
  emptyMessage: string
): PersonalBreakdownPresentation {
  const labels = items.map(item => item.name)
  const values = items.map(item => item.hours)
  const summary = items.map(item => `${item.name} ${item.hours} hours`).join('; ')

  return {
    title,
    unit: 'Tracked time · hours',
    datasetLabel: 'Hours',
    labels,
    values,
    description: summary ? `Tracked hours by ${grouping}: ${summary}.` : emptyMessage,
    emptyMessage,
    precision: 1
  }
}
