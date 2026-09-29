import { requireSessionUser } from '../utils/auth'
import {
  buildCompanyDashboard,
  companyDashboardGroupings,
  companyDashboardMetrics,
  type CompanyDashboardGrouping,
  type CompanyDashboardMetric
} from '../utils/store'

function singleQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value
}

function optionalCategoryId(value: unknown) {
  const raw = singleQueryValue(value)
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw !== 'string' || raw.trim().length > 128) {
    throw createError({ statusCode: 400, statusMessage: 'categoryId must be a valid category ID.' })
  }
  return raw.trim()
}

function companyWeekStart(value: unknown) {
  const raw = singleQueryValue(value)
  if (raw === undefined || raw === null || raw === '') return undefined
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw createError({ statusCode: 400, statusMessage: 'weekStart must be a Monday in YYYY-MM-DD format.' })
  }
  const date = new Date(`${raw}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.getUTCDay() !== 1 || date.toISOString().slice(0, 10) !== raw) {
    throw createError({ statusCode: 400, statusMessage: 'weekStart must be a Monday in YYYY-MM-DD format.' })
  }
  return date
}

function companyEnum<T extends readonly string[]>(field: string, value: unknown, allowed: T, fallback: T[number]) {
  const raw = singleQueryValue(value)
  if (raw === undefined || raw === null || raw === '') return fallback
  if (typeof raw !== 'string' || !allowed.includes(raw)) {
    throw createError({ statusCode: 400, statusMessage: `${field} must be one of: ${allowed.join(', ')}.` })
  }
  return raw as T[number]
}

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const query = getQuery(event)
  return buildCompanyDashboard({
    categoryId: optionalCategoryId(query.categoryId),
    weekStart: companyWeekStart(query.weekStart),
    metric: companyEnum('metric', query.metric, companyDashboardMetrics, 'trackedTime') as CompanyDashboardMetric,
    groupBy: companyEnum('groupBy', query.groupBy, companyDashboardGroupings, 'category') as CompanyDashboardGrouping
  })
})

