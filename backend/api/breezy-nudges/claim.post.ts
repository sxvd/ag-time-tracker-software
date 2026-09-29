import { requireSessionUser } from '../../utils/auth'
import { claimDueBreezyNudge } from '../../utils/breezy-nudges'
import { requiredString } from '../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  return {
    nudge: await claimDueBreezyNudge(
      user.id,
      requiredString('entryId', body.entryId, { max: 128 })
    )
  }
})
