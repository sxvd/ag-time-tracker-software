import { describe, expect, it } from 'vitest'
import {
  boundedInteger,
  booleanValue,
  enumValue,
  isoDate,
  optionalBoundedInteger,
  pauseWindows,
  requiredString,
  stringArray
} from '../../backend/utils/validation'

describe('API runtime validation', () => {
  it('requires a non-empty bounded string', () => {
    expect(requiredString('title', '  Focus work  ', { max: 40 })).toBe('Focus work')
    expect(() => requiredString('title', '   ', { max: 40 })).toThrow(/title/i)
    expect(() => requiredString('title', 'x'.repeat(41), { max: 40 })).toThrow(/title/i)
  })

  it('accepts only finite bounded integers', () => {
    expect(boundedInteger('contextSwitches', 4, { min: 0, max: 100 })).toBe(4)
    expect(() => boundedInteger('contextSwitches', -1, { min: 0, max: 100 })).toThrow(/contextSwitches/)
    expect(() => boundedInteger('contextSwitches', 1.5, { min: 0, max: 100 })).toThrow(/contextSwitches/)
    expect(() => boundedInteger('contextSwitches', Number.POSITIVE_INFINITY, { min: 0, max: 100 })).toThrow(/contextSwitches/)
  })

  it('validates optional integers, booleans, and bounded string arrays', () => {
    expect(optionalBoundedInteger('estimateMinutes', undefined, { min: 1, max: 10_000 })).toBeUndefined()
    expect(optionalBoundedInteger('estimateMinutes', 60, { min: 1, max: 10_000 })).toBe(60)
    expect(booleanValue('muted', false)).toBe(false)
    expect(() => booleanValue('muted', 'false')).toThrow(/muted/)
    expect(stringArray('members', ['u1', 'u2', 'u1'], { itemMax: 128, maxItems: 20 })).toEqual(['u1', 'u2'])
    expect(() => stringArray('members', new Array(21).fill('u1'), { itemMax: 128, maxItems: 20 })).toThrow(/members/)
  })

  it('validates allowlisted values and ISO dates', () => {
    expect(enumValue('energy', 'High', ['High', 'OK', 'Drained'] as const)).toBe('High')
    expect(() => enumValue('energy', 'Unknown', ['High', 'OK', 'Drained'] as const)).toThrow(/energy/i)
    expect(isoDate('startedAt', '2026-07-13T09:00:00.000Z').toISOString()).toBe('2026-07-13T09:00:00.000Z')
    expect(() => isoDate('startedAt', 'not-a-date')).toThrow(/startedAt/)
  })

  it('rejects pauses outside the entry or overlapping each other', () => {
    const entryStart = new Date('2026-07-13T09:00:00.000Z')
    const entryEnd = new Date('2026-07-13T10:00:00.000Z')

    expect(pauseWindows('pauses', [{
      startedAt: '2026-07-13T09:10:00.000Z',
      endedAt: '2026-07-13T09:20:00.000Z'
    }], entryStart, entryEnd)).toHaveLength(1)

    expect(() => pauseWindows('pauses', [{
      startedAt: '2026-07-13T08:50:00.000Z',
      endedAt: '2026-07-13T09:10:00.000Z'
    }], entryStart, entryEnd)).toThrow(/pauses/)

    expect(() => pauseWindows('pauses', [
      { startedAt: '2026-07-13T09:10:00.000Z', endedAt: '2026-07-13T09:30:00.000Z' },
      { startedAt: '2026-07-13T09:20:00.000Z', endedAt: '2026-07-13T09:40:00.000Z' }
    ], entryStart, entryEnd)).toThrow(/overlap/i)
  })
})
