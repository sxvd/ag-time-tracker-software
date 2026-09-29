import { describe, expect, it } from 'vitest'
import { blockerRollup, recordedCountBy, weeklyAverageTrend } from '../../backend/utils/store'

describe('company dashboard aggregation', () => {
  it('counts only recorded feedback values', () => {
    const entries = [
      { flow: 'Great flow' },
      { flow: 'Great flow' },
      { flow: 'Neutral' },
      { flow: 'Skipped' },
      { flow: null },
      {}
    ]

    expect(recordedCountBy(entries, entry => entry.flow)).toEqual([
      { name: 'Great flow', count: 2 },
      { name: 'Neutral', count: 1 }
    ])
  })

  it('keeps at most five blocker patterns ordered by time, then affected-session count', () => {
    const entry = (durationSeconds: number, name: string) => ({
      durationSeconds,
      blockers: [{ blocker: { name } }]
    })
    const entries = [
      entry(3_600, 'One long session'),
      entry(1_800, 'Two sessions'),
      entry(1_800, 'Two sessions'),
      entry(7_200, 'Largest'),
      entry(2_700, 'Fourth'),
      entry(1_800, 'Fifth'),
      entry(900, 'Excluded'),
      entry(20_000, 'None')
    ]

    expect(blockerRollup(entries, 5)).toEqual([
      { name: 'Largest', count: 1, hours: 2 },
      { name: 'Two sessions', count: 2, hours: 1 },
      { name: 'One long session', count: 1, hours: 1 },
      { name: 'Fourth', count: 1, hours: 0.8 },
      { name: 'Fifth', count: 1, hours: 0.5 }
    ])
  })

  it('returns average context switches per completed session for each week', () => {
    const entries = [
      { startedAt: new Date('2026-01-05T09:00:00.000Z'), contextSwitches: 1 },
      { startedAt: new Date('2026-01-09T09:00:00.000Z'), contextSwitches: 3 },
      { startedAt: new Date('2026-01-12T09:00:00.000Z'), contextSwitches: 0 },
      { startedAt: new Date('2026-01-13T09:00:00.000Z'), contextSwitches: 1 },
      { startedAt: new Date('2026-01-16T09:00:00.000Z'), contextSwitches: 1 }
    ]

    expect(weeklyAverageTrend(entries, entry => entry.contextSwitches)).toEqual([
      { name: 'Jan 4', value: 2 },
      { name: 'Jan 11', value: 0.7 }
    ])
  })

  it('keeps only the latest eight weeks in chronological order', () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      startedAt: new Date(Date.UTC(2026, 0, 4 + (index * 7))),
      contextSwitches: index
    })).reverse()

    expect(weeklyAverageTrend(entries, entry => entry.contextSwitches)).toEqual([
      { name: 'Jan 18', value: 2 },
      { name: 'Jan 25', value: 3 },
      { name: 'Feb 1', value: 4 },
      { name: 'Feb 8', value: 5 },
      { name: 'Feb 15', value: 6 },
      { name: 'Feb 22', value: 7 },
      { name: 'Mar 1', value: 8 },
      { name: 'Mar 8', value: 9 }
    ])
  })

  it('returns no buckets when there are no completed sessions', () => {
    expect(weeklyAverageTrend([], () => 0)).toEqual([])
  })
})
