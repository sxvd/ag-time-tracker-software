import type { EntryFeedbackInput } from '../../utils/store'
import type { ClosedPauseWindow } from '../../../shared/utils/time'
import { requireSessionUser } from '../../utils/auth'
import { publicState, updateEntry } from '../../utils/store'
import { optionalString, requiredString, stringArray } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const entryId = requiredString('entryId', getRouterParam(event, 'id'), { max: 128 })
  const body = await readBody<Record<string, unknown>>(event)
  if (!Array.isArray(body.pauses)) throw createError({ statusCode: 400, statusMessage: 'pauses must be an array.' })

  await updateEntry(user.id, entryId, {
    taskId: requiredString('taskId', body.taskId, { max: 128 }),
    startedAt: requiredString('startedAt', body.startedAt, { max: 64 }),
    endedAt: requiredString('endedAt', body.endedAt, { max: 64 }),
    locationLabel: body.locationLabel === undefined
      ? undefined
      : (optionalString('locationLabel', body.locationLabel, { max: 100 }) || ''),
    pauses: body.pauses as ClosedPauseWindow[],
    feedback: body.feedback as EntryFeedbackInput | undefined,
    blockers: body.blockers === undefined ? ['None'] : stringArray('blockers', body.blockers, { itemMax: 100, maxItems: 20 })
  })
  return publicState(user.id)
})
