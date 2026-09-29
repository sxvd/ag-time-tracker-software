import { awardMedalsFromSessions, deriveBreezyDayFromSessions } from './breezy.mjs'

export type IdleDecision = 'keep' | 'discard' | 'break'
export type FlowQuality = 'Great flow' | 'Neutral' | 'Friction'
export type EfficiencyFeel = 'Felt efficient' | 'Felt manual' | 'Felt wasteful'
export type EnergyLevel = 'High' | 'OK' | 'Drained'

export interface PauseWindow {
  startedAt: string
  endedAt: string | null
}

export interface ClosedPauseWindow extends PauseWindow {
  endedAt: string
}

export interface SessionForAwards {
  durationSeconds: number
  flowQuality?: FlowQuality
  efficiencyFeel?: EfficiencyFeel
  energy?: EnergyLevel
  blockers?: string[]
  idleSeconds: number
  breakSeconds: number
  contextSwitches: number
}

export interface ContextSwitchTransition {
  previous: 'visible' | 'hidden'
  current: 'visible' | 'hidden'
  active: boolean
  paused: boolean
  enabled: boolean
}

export function shouldRecordContextSwitch(input: ContextSwitchTransition) {
  return input.previous === 'visible'
    && input.current === 'hidden'
    && input.active
    && !input.paused
    && input.enabled
}

export function secondsBetween(startedAt: string | Date, endedAt: string | Date) {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
}

export function pauseSeconds(pauses: PauseWindow[]) {
  return pauses.reduce((total, pause) => total + (pause.endedAt ? secondsBetween(pause.startedAt, pause.endedAt) : 0), 0)
}

export function calculateDuration(startedAt: string, endedAt: string, pauses: PauseWindow[] = [], idleSeconds = 0) {
  return Math.max(0, secondsBetween(startedAt, endedAt) - pauseSeconds(pauses) - idleSeconds)
}

export function applyIdleDecision(durationSeconds: number, idleSeconds: number, decision: IdleDecision) {
  if (decision === 'keep') return { durationSeconds, idleSeconds, breakSeconds: 0 }
  if (decision === 'discard') return { durationSeconds: Math.max(0, durationSeconds - idleSeconds), idleSeconds, breakSeconds: 0 }
  return { durationSeconds: Math.max(0, durationSeconds - idleSeconds), idleSeconds, breakSeconds: idleSeconds }
}

export function countContextSwitches(previousCount: number, becameHidden: boolean) {
  return becameHidden ? previousCount + 1 : previousCount
}

export function formatTrackedDuration(durationSeconds: number) {
  const seconds = Number.isFinite(durationSeconds) ? Math.max(0, Math.floor(durationSeconds)) : 0
  if (seconds === 0) return '0 minutes'
  if (seconds < 60) return '< 1 minute'

  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []

  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)

  return parts.join(' ')
}

export function deriveBreezyDay(sessions: SessionForAwards[]) {
  return deriveBreezyDayFromSessions(sessions)
}

export function awardMedals(sessions: SessionForAwards[]) {
  return awardMedalsFromSessions(sessions)
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => {
    const text = String(value ?? '')
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n')
}
