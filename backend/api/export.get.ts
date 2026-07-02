import { requireSessionUser } from '../utils/auth'
import { exportData } from '../utils/store'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const query = getQuery(event)
  const format = query.format === 'csv' ? 'csv' : 'json'
  setHeader(event, 'content-type', format === 'csv' ? 'text/csv' : 'application/json')
  setHeader(event, 'content-disposition', `attachment; filename="airgradient-time.${format}"`)
  return exportData(user.id, format)
})
