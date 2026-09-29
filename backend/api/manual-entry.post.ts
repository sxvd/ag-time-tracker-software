import { requireSessionUser } from '../utils/auth'
import { createManualEntry, publicState } from '../utils/store'
import type { EntryFeedbackInput } from '../utils/store'
import { optionalBoundedInteger, optionalString, requiredString, stringArray } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await createManualEntry({
    userId: user.id,
    taskId: optionalString('taskId', body.taskId, { max: 128 }),
    startedAt: requiredString('startedAt', body.startedAt, { max: 64 }),
    endedAt: requiredString('endedAt', body.endedAt, { max: 64 }),
    idleSeconds: optionalBoundedInteger('idleSeconds', body.idleSeconds, { min: 0, max: 31_536_000 }),
    contextSwitches: optionalBoundedInteger('contextSwitches', body.contextSwitches, { min: 0, max: 1_000_000 }),
    locationLabel: optionalString('locationLabel', body.locationLabel, { max: 100 }),
    feedback: body.feedback as EntryFeedbackInput | undefined,
    blockers: body.blockers === undefined ? ['None'] : stringArray('blockers', body.blockers, { itemMax: 100, maxItems: 20 })
  })
  return publicState(user.id)
})
