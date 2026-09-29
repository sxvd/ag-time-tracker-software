export interface BreezySession {
  durationSeconds: number
  flowQuality?: string
  efficiencyFeel?: string
  energy?: string
  blockers?: string[]
  idleSeconds: number
  breakSeconds: number
  contextSwitches: number
}

export function deriveBreezyDayFromSessions(sessions: BreezySession[]): {
  mood: string
  airClarityScore: number
}

export function awardMedalsFromSessions(sessions: BreezySession[]): string[]
