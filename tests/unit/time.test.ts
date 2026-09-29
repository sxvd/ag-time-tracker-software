import { describe, expect, it } from 'vitest'
import {
  applyIdleDecision,
  awardMedals,
  calculateDuration,
  countContextSwitches,
  deriveBreezyDay,
  formatTrackedDuration
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

  it('formats tracked duration as complete human-readable hours and minutes', () => {
    expect(formatTrackedDuration(0)).toBe('0 minutes')
    expect(formatTrackedDuration(59)).toBe('< 1 minute')
    expect(formatTrackedDuration(60)).toBe('1 minute')
    expect(formatTrackedDuration(3599)).toBe('59 minutes')
    expect(formatTrackedDuration(3600)).toBe('1 hour')
    expect(formatTrackedDuration(3660)).toBe('1 hour 1 minute')
    expect(formatTrackedDuration(33779)).toBe('9 hours 22 minutes')
    expect(formatTrackedDuration(-10)).toBe('0 minutes')
    expect(formatTrackedDuration(Number.NaN)).toBe('0 minutes')
  })

  it('derives Breezy mood and clarity from session quality', () => {
    const day = deriveBreezyDay([
      { durationSeconds: 3600, flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High', blockers: ['None'], idleSeconds: 300, breakSeconds: 300, contextSwitches: 1 }
    ])

    expect(day.airClarityScore).toBeGreaterThan(75)
    expect(day.mood).toMatch(/happy|cheering/)
  })

  it('awards medals from honest tracking patterns', () => {
    const medals = awardMedals([
      { durationSeconds: 3600, flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High', blockers: ['Tool was slow or broke'], idleSeconds: 300, breakSeconds: 300, contextSwitches: 1 }
    ])

    expect(medals).toContain('flow-state')
    expect(medals).toContain('straight-shooter')
  })

  it('uses actual break time rather than kept or discarded idle for Breezy rewards', () => {
    const idleWithoutBreak = {
      durationSeconds: 3600,
      flowQuality: 'Neutral' as const,
      efficiencyFeel: 'Felt efficient' as const,
      energy: 'OK' as const,
      blockers: ['None'],
      idleSeconds: 600,
      breakSeconds: 0,
      contextSwitches: 0
    }
    const splitAsBreak = { ...idleWithoutBreak, breakSeconds: 600 }

    expect(deriveBreezyDay([idleWithoutBreak]).airClarityScore).toBe(70)
    expect(deriveBreezyDay([splitAsBreak]).airClarityScore).toBe(72)
    expect(awardMedals([idleWithoutBreak])).not.toContain('sustainable-pace')
    expect(awardMedals([splitAsBreak])).toContain('sustainable-pace')
  })
})
