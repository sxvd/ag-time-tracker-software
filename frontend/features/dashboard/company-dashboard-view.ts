import type { ApiCompanyDashboard } from '~/types/api'

export type CompanyOverviewChartType = 'bar' | 'line'

export interface CompanyOverviewDataset {
  label: string
  color: string
  values: number[]
}

const overviewColors = ['#FC7E10', '#1C75BC', '#38BDF8', '#34D399', '#A78BFA', '#F472B6']

function labelForMetric(metric: ApiCompanyDashboard['overview']['metric']) {
  if (metric === 'trackedTime') return { label: 'Tracked time', unit: 'Hours', precision: 1 }
  if (metric === 'sessions') return { label: 'Work entries', unit: 'Work entries', precision: 0 }
  return { label: 'Context switches', unit: 'Switches', precision: 0 }
}

function labelForGroup(groupBy: ApiCompanyDashboard['overview']['groupBy']) {
  return groupBy === 'category' ? 'category' : groupBy === 'flow' ? 'flow' : 'efficiency'
}

export function buildCompanyOverview(dashboard: ApiCompanyDashboard) {
  const { metric, groupBy, days } = dashboard.overview
  const metricInfo = labelForMetric(metric)
  const groupLabel = labelForGroup(groupBy)
  const names = new Set<string>()
  for (const day of days) for (const item of day.series) names.add(item.name)

  const total = (name: string) => days.reduce(
    (sum, day) => sum + (day.series.find(item => item.name === name)?.value || 0),
    0
  )
  const sortedNames = [...names].sort((left, right) => total(right) - total(left) || left.localeCompare(right))
  const datasets: CompanyOverviewDataset[] = sortedNames.map((name, index) => ({
    label: name,
    color: overviewColors[index % overviewColors.length]!,
    values: days.map((day) => {
      const value = day.series.find(item => item.name === name)?.value || 0
      return metric === 'trackedTime' ? Math.round((value / 3600) * 100) / 100 : value
    })
  }))
  const labels = days.map(day => day.label)
  const qualifier = groupBy === 'category' ? '' : ' Recorded feedback only.'
  const emptyMessage = groupBy === 'category'
    ? `No company ${metricInfo.label.toLowerCase()} was recorded in this week.`
    : `No recorded ${groupLabel} feedback was available in this week.`
  const summary = datasets.map(dataset => `${dataset.label}: ${dataset.values.join(', ')} ${metricInfo.unit.toLowerCase()}`).join('; ')
  const dailyTotals = labels.map((_, index) => datasets.reduce((sum, dataset) => sum + dataset.values[index]!, 0))
  const topDayIndex = dailyTotals.reduce((best, value, index) => value > (dailyTotals[best] || 0) ? index : best, 0)
  const topDataset = datasets[0]

  return {
    labels,
    datasets,
    title: `Daily ${metricInfo.label.toLowerCase()} by ${groupLabel}`,
    unit: metricInfo.unit,
    precision: metricInfo.precision,
    description: summary
      ? `${metricInfo.label} by day and ${groupLabel} for ${dashboard.week.label}: ${summary}.${qualifier}`
      : `${emptyMessage}${qualifier}`,
    emptyMessage: `${emptyMessage}${qualifier}`,
    insight: topDataset
      ? `${topDataset.label} had the highest ${metricInfo.label.toLowerCase()}; ${labels[topDayIndex]} had the highest daily total.`
      : `${emptyMessage}${qualifier}`
  }
}

export interface CompanySignalPresentation {
  total: number
  items: Array<{ name: string, count: number, percentage: number }>
}

export function buildCompanySignal(items: ApiCompanyDashboard['flow']): CompanySignalPresentation {
  const recorded = items.filter(item => item.name !== 'Skipped' && item.count > 0)
  const total = recorded.reduce((sum, item) => sum + item.count, 0)
  return {
    total,
    items: recorded.map(item => ({
      ...item,
      percentage: total ? Math.round((item.count / total) * 100) : 0
    }))
  }
}

export function buildCompanyBlockers(items: ApiCompanyDashboard['blockers']) {
  return [...items]
    .filter(item => item.count > 0)
    .sort((left, right) => right.hours - left.hours || right.count - left.count || left.name.localeCompare(right.name))
}

export function companyScopeLabel(dashboard: ApiCompanyDashboard) {
  return dashboard.categoryId
    ? dashboard.availableCategories.find(category => category.id === dashboard.categoryId)?.name || 'Selected category'
    : 'All categories'
}
