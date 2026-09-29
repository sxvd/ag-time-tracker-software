import { requireSessionUser } from '../utils/auth'
import { publicState, stopEntry } from '../utils/store'
import type { EntryFeedbackInput } from '../utils/store'
import { requiredString, stringArray } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await stopEntry({
    entryId: requiredString('entryId', body.entryId, { max: 128 }),
    userId: user.id,
    feedback: body.feedback as EntryFeedbackInput | undefined,
    blockers: body.blockers === undefined ? ['None'] : stringArray('blockers', body.blockers, { itemMax: 100, maxItems: 20 })
  })
  return publicState(user.id)
})
