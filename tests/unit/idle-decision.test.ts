import { describe, expect, it } from 'vitest'
import { applyIdleDecision } from '../../shared/utils/time'

describe('idle decision calculations', () => {
  it('keeps detected idle time in the tracked duration', () => {
    expect(applyIdleDecision(3_600, 300, 'keep')).toEqual({
      durationSeconds: 3_600,
      idleSeconds: 300,
      breakSeconds: 0
    })
  })

  it('discards detected idle time from the tracked duration', () => {
    expect(applyIdleDecision(3_600, 300, 'discard')).toEqual({
      durationSeconds: 3_300,
      idleSeconds: 300,
      breakSeconds: 0
    })
  })

  it('splits detected idle time into a break', () => {
    expect(applyIdleDecision(3_600, 300, 'break')).toEqual({
      durationSeconds: 3_300,
      idleSeconds: 300,
      breakSeconds: 300
    })
  })
})
