export function deriveBreezyDayFromSessions(sessions) {
  const trackedHours = sessions.reduce((sum, session) => sum + session.durationSeconds, 0) / 3600
  const greatFlow = sessions.filter((session) => session.flowQuality === 'Great flow').length
  const friction = sessions.filter((session) => session.flowQuality === 'Friction').length
  const switches = sessions.reduce((sum, session) => sum + session.contextSwitches, 0)
  const blockers = sessions.reduce((sum, session) => sum + (session.blockers?.filter((blocker) => blocker !== 'None').length || 0), 0)
  const breaks = sessions.reduce((sum, session) => sum + session.breakSeconds, 0)
  const airClarityScore = Math.max(30, Math.min(100, Math.round(70 + greatFlow * 8 + Math.min(breaks / 300, 10) - friction * 9 - switches * 1.5 - blockers * 5)))
  let mood = 'idle'
  if (airClarityScore >= 86 && trackedHours > 0) mood = 'cheering'
  else if (airClarityScore >= 74) mood = 'happy'
  else if (airClarityScore >= 55) mood = 'waving'
  else mood = 'sleepy'
  return { mood, airClarityScore }
}

export function awardMedalsFromSessions(sessions) {
  const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0)
  const blockers = sessions.flatMap((session) => session.blockers || [])
  const medals = new Set()
  if (sessions.some((session) => session.flowQuality === 'Great flow')) medals.add('flow-state')
  if (sessions.length >= 5) medals.add('steady-breeze')
  if (totalSeconds >= 8 * 3600) medals.add('in-the-zone')
  if (blockers.some((blocker) => blocker !== 'None')) medals.add('straight-shooter')
  if (sessions.some((session) => session.breakSeconds >= 300)) medals.add('sustainable-pace')
  if (sessions.some((session) => session.contextSwitches <= 1 && session.durationSeconds >= 1800)) medals.add('single-tasker')
  return [...medals]
}
