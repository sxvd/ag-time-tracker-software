import { describe, expect, it } from 'vitest'
import { shouldRecordContextSwitch } from '../../backend/utils/timer-activity'

describe('context-switch transition policy', () => {
  it('records a visible-to-hidden transition while active and enabled', () => {
    expect(shouldRecordContextSwitch({
      previous: 'visible',
      current: 'hidden',
      active: true,
      paused: false,
      enabled: true
    })).toBe(true)
  })

  it('ignores a repeated hidden state', () => {
    expect(shouldRecordContextSwitch({
      previous: 'hidden',
      current: 'hidden',
      active: true,
      paused: false,
      enabled: true
    })).toBe(false)
  })

  it('ignores a transition while the timer is paused', () => {
    expect(shouldRecordContextSwitch({
      previous: 'visible',
      current: 'hidden',
      active: true,
      paused: true,
      enabled: true
    })).toBe(false)
  })

  it('ignores a transition while activity tracking is disabled', () => {
    expect(shouldRecordContextSwitch({
      previous: 'visible',
      current: 'hidden',
      active: true,
      paused: false,
      enabled: false
    })).toBe(false)
  })
})
