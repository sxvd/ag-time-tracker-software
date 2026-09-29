import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

describe('Prisma schema', () => {
  it('requires every user to have a password hash', () => {
    const user = Prisma.dmmf.datamodel.models.find((model) => model.name === 'User')
    const passwordHash = user?.fields.find((field) => field.name === 'passwordHash')

    expect(passwordHash).toMatchObject({
      isRequired: true,
      type: 'String'
    })
  })

  it('does not retain the deferred task estimate field', () => {
    const task = Prisma.dmmf.datamodel.models.find((model) => model.name === 'Task')

    expect(task?.fields.some((field) => field.name === 'estimateMinutes')).toBe(false)
  })
})
