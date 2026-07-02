import { describe, expect, it } from 'vitest'
import { canTrackTask, normalizeBlockers } from '../../backend/utils/store'

describe('time tracking domain helpers', () => {
  it('normalizes None out when real blockers are selected', () => {
    expect(normalizeBlockers(['None', 'Context switching', 'Context switching'])).toEqual(['Context switching'])
  })

  it('defaults empty blocker selections to None', () => {
    expect(normalizeBlockers([])).toEqual(['None'])
  })

  it('allows task owners and members to track a task', () => {
    const task = { ownerId: 'u1', members: ['u1', 'u2'] }

    expect(canTrackTask(task, 'u1')).toBe(true)
    expect(canTrackTask(task, 'u2')).toBe(true)
    expect(canTrackTask(task, 'u3')).toBe(false)
  })
})
