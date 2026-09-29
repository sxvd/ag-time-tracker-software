import { requireSessionUser } from '../utils/auth'
import { publicState } from '../utils/store'
import { recordIdleDecision } from '../utils/timer-activity'
import { enumValue, isoDate, requiredString } from '../utils/validation'

const idleDecisions = ['keep', 'discard', 'break'] as const

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await recordIdleDecision(
    user.id,
    requiredString('entryId', body.entryId, { max: 128 }),
    {
      decisionId: requiredString('decisionId', body.decisionId, { max: 128 }),
      decision: enumValue('decision', body.decision, idleDecisions),
      startedAt: isoDate('startedAt', body.startedAt).toISOString(),
      endedAt: isoDate('endedAt', body.endedAt).toISOString()
    }
  )
  return publicState(user.id)
})
