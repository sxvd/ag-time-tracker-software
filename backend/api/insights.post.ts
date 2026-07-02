import { requireSessionUser } from '../utils/auth'
import { buildDashboards } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<{ scope: 'personal' | 'company', team?: string }>(event)
  const apiKey = useRuntimeConfig(event).aiInsightsApiKey
  const dashboards = await buildDashboards(user.id, body.team || 'All')

  if (!apiKey) {
    const personal = dashboards.personal.blockers[0]
      ? `Your clearest personal improvement is reducing ${dashboards.personal.blockers[0].name.toLowerCase()}, which is attached to ${dashboards.personal.blockers[0].hours}h this period.`
      : 'Your recent sessions look blocker-light. Keep naming friction when it appears so patterns stay visible.'
    const company = dashboards.company.blockers[0]
      ? `At company level, ${dashboards.company.blockers[0].name.toLowerCase()} is the highest-cost blocker. Treat it as a process issue, not an individual score.`
      : 'Company data is currently calm. Keep rollups aggregated and watch category trends after process changes.'
    return {
      degraded: true,
      suggestion: body.scope === 'company' ? company : personal
    }
  }

  return {
    degraded: false,
    suggestion: 'AI key detected. A production deployment can swap this stub for the provider call without changing the UI contract.'
  }
})
