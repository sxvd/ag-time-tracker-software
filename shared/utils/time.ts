export type IdleDecision = 'keep' | 'discard' | 'break'
export type FlowQuality = 'Great flow' | 'Neutral' | 'Friction'
export type EfficiencyFeel = 'Felt efficient' | 'Felt manual' | 'Felt wasteful'
export type EnergyLevel = 'High' | 'OK' | 'Drained'

export interface PauseWindow {
  startedAt: string
  endedAt: string
}

export interface SessionForAwards {
  durationSeconds: number
  flowQuality?: FlowQuality
  efficiencyFeel?: EfficiencyFeel
  energy?: EnergyLevel
  blockers?: string[]
  idleSeconds: number
  contextSwitches: number
}

export function secondsBetween(startedAt: string | Date, endedAt: string | Date) {
  return Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))
}

export function pauseSeconds(pauses: PauseWindow[]) {
  return pauses.reduce((total, pause) => total + secondsBetween(pause.startedAt, pause.endedAt), 0)
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

export function estimateVarianceMinutes(estimateMinutes: number | null | undefined, actualSeconds: number) {
  if (!estimateMinutes) return null
  return Math.round(actualSeconds / 60 - estimateMinutes)
}

export function deriveBreezyDay(sessions: SessionForAwards[]) {
  const trackedHours = sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 3600
  const greatFlow = sessions.filter((session) => session.flowQuality === 'Great flow').length
  const friction = sessions.filter((session) => session.flowQuality === 'Friction').length
  const switches = sessions.reduce((sum, session) => sum + session.contextSwitches, 0)
  const blockers = sessions.reduce((sum, session) => sum + (session.blockers?.filter((blocker) => blocker !== 'None').length || 0), 0)
  const breaks = sessions.reduce((sum, session) => sum + session.idleSeconds, 0)
  const airClarityScore = Math.max(30, Math.min(100, Math.round(70 + greatFlow * 8 + Math.min(breaks / 300, 10) - friction * 9 - switches * 1.5 - blockers * 5)))
  let mood = 'idle'
  if (airClarityScore >= 86 && trackedHours > 0) mood = 'cheering'
  else if (airClarityScore >= 74) mood = 'happy'
  else if (airClarityScore >= 55) mood = 'waving'
  else mood = 'sleepy'
  return { mood, airClarityScore }
}

export function awardMedals(sessions: SessionForAwards[]) {
  const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0)
  const blockers = sessions.flatMap((session) => session.blockers || [])
  const medals = new Set<string>()
  if (sessions.some((session) => session.flowQuality === 'Great flow')) medals.add('flow-state')
  if (sessions.length >= 5) medals.add('steady-breeze')
  if (totalSeconds >= 8 * 3600) medals.add('in-the-zone')
  if (blockers.some((blocker) => blocker !== 'None')) medals.add('straight-shooter')
  if (sessions.some((session) => session.idleSeconds >= 300)) medals.add('sustainable-pace')
  if (sessions.some((session) => session.contextSwitches <= 1 && session.durationSeconds >= 1800)) medals.add('single-tasker')
  return [...medals]
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
