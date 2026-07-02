import { describe, expect, it } from 'vitest'
import {
  applyIdleDecision,
  awardMedals,
  calculateDuration,
  countContextSwitches,
  deriveBreezyDay,
  estimateVarianceMinutes
} from '../../shared/utils/time'

describe('time utilities', () => {
  it('calculates duration minus pauses and idle time', () => {
    const duration = calculateDuration(
      '2026-06-09T09:00:00.000Z',
      '2026-06-09T10:00:00.000Z',
      [{ startedAt: '2026-06-09T09:20:00.000Z', endedAt: '2026-06-09T09:30:00.000Z' }],
      300
    )

    expect(duration).toBe(2700)
  })

  it('splits idle as break time', () => {
    expect(applyIdleDecision(3600, 600, 'break')).toEqual({ durationSeconds: 3000, idleSeconds: 600, breakSeconds: 600 })
  })

  it('counts only visibility context switches', () => {
    expect(countContextSwitches(2, true)).toBe(3)
    expect(countContextSwitches(2, false)).toBe(2)
  })

  it('computes estimate variance', () => {
    expect(estimateVarianceMinutes(45, 3600)).toBe(15)
  })

  it('derives Breezy mood and clarity from session quality', () => {
    const day = deriveBreezyDay([
      { durationSeconds: 3600, flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High', blockers: ['None'], idleSeconds: 300, contextSwitches: 1 }
    ])

    expect(day.airClarityScore).toBeGreaterThan(75)
    expect(day.mood).toMatch(/happy|cheering/)
  })

  it('awards medals from honest tracking patterns', () => {
    const medals = awardMedals([
      { durationSeconds: 3600, flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High', blockers: ['Tool was slow or broke'], idleSeconds: 300, contextSwitches: 1 }
    ])

    expect(medals).toContain('flow-state')
    expect(medals).toContain('straight-shooter')
  })
})
