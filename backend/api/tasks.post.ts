import { requireSessionUser } from '../utils/auth'
import { createTask, publicState } from '../utils/store'
import { optionalBoundedInteger, optionalString, requiredString, stringArray } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody<Record<string, unknown>>(event)
  await createTask({
    title: requiredString('title', body.title, { max: 200 }),
    description: optionalString('description', body.description, { max: 2_000 }),
    categoryId: optionalString('categoryId', body.categoryId, { max: 128 }),
    clientId: optionalString('clientId', body.clientId, { max: 128 }),
    projectId: optionalString('projectId', body.projectId, { max: 128 }),
    estimateMinutes: optionalBoundedInteger('estimateMinutes', body.estimateMinutes, { min: 1, max: 100_000 }),
    members: body.members === undefined ? [] : stringArray('members', body.members, { itemMax: 128, maxItems: 100 }),
    ownerId: user.id
  })
  return publicState(user.id)
})
