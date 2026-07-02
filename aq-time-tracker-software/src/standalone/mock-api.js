const STORE_KEY = 'ag-standalone-demo-state-v1'
const TOKEN_PREFIX = 'standalone-token-'
const nativeFetch = window.fetch.bind(window)

const clone = (value) => JSON.parse(JSON.stringify(value))
const nowIso = () => new Date().toISOString()
const newId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dowOf = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function text(data, contentType, filename) {
  return new Response(data, {
    status: 200,
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${filename}"`,
    },
  })
}

async function readBody(init) {
  if (!init?.body) return {}
  if (typeof init.body === 'string') return JSON.parse(init.body || '{}')
  return JSON.parse(await init.body.text())
}

function defaultSettings() {
  return {
    idleThreshold: 5,
    nudgeCadence: 90,
    verbosity: 'gentle',
    muted: false,
    theme: 'light',
    locationEnabled: false,
  }
}

function makeInitialState() {
  const AG = window.AG
  return {
    users: clone(AG.users).map((user) => ({ ...user, lastSignedInAt: user.lastSignedInAt || nowIso() })),
    categories: clone(AG.categories),
    teams: clone(AG.teams || []),
    clients: clone(AG.clients || []),
    projects: clone(AG.projects || []),
    tasks: clone(AG.tasks).map((task) => ({
      ...task,
      createdAt: task.createdAt || nowIso(),
      isArchived: !!task.isArchived,
      members: [...new Set([task.ownerId, ...(task.members || [])])],
    })),
    entries: clone(AG.entries),
    blockerDefs: clone(AG.blockerDefs || []),
    medals: clone(AG.medals || []),
    breezyDays: clone(AG.breezyDays || {}),
    settingsByUser: Object.fromEntries((AG.users || []).map((user) => [user.id, defaultSettings()])),
    sessions: {},
    activeSessions: [],
    todayKey: AG.TODAY_KEY || dateKey(new Date()),
  }
}

function loadState() {
  const saved = localStorage.getItem(STORE_KEY)
  if (saved) return JSON.parse(saved)
  const state = makeInitialState()
  saveState(state)
  return state
}

function saveState(state) {
  localStorage.setItem(STORE_KEY, JSON.stringify(state))
}

function publicUser(user) {
  return user ? {
    id: user.id,
    email: user.email,
    name: user.name || user.display_name || user.email,
    team: user.team || 'Software',
  } : null
}

function userFromToken(state, init) {
  const auth = init?.headers?.authorization || init?.headers?.Authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const uid = state.sessions[token]
  return state.users.find((user) => user.id === uid) || null
}

function bootstrap(state, user) {
  return {
    me: publicUser(user),
    users: state.users.map(publicUser),
    categories: clone(state.categories),
    teams: clone(state.teams),
    clients: clone(state.clients),
    projects: clone(state.projects),
    tasks: clone(state.tasks),
    entries: clone(state.entries),
    blockerDefs: clone(state.blockerDefs),
    medals: clone(state.medals),
    breezyDays: clone(state.breezyDays),
    company: { name: 'AirGradient', size: state.users.length },
    settings: { ...defaultSettings(), ...(state.settingsByUser[user.id] || {}) },
  }
}

function requireUser(state, init) {
  const user = userFromToken(state, init)
  if (!user) return { error: json({ error: 'Please sign in again.' }, 401) }
  return { user }
}

function ensureTask(state, user, input) {
  if (input.taskId && input.taskId !== 'draft') {
    const existing = state.tasks.find((task) => task.id === input.taskId)
    if (existing) return existing
  }
  const id = newId('t')
  const task = {
    id,
    title: input.title || input._draftTitle || 'Untitled task',
    description: '',
    categoryId: input.categoryId || input._draftCat || 'deep',
    clientId: null,
    projectId: null,
    estimateMinutes: Number(input.estimateMinutes || 0),
    ownerId: user.id,
    isShared: false,
    isArchived: false,
    createdAt: nowIso(),
    members: [user.id],
  }
  state.tasks.push(task)
  return task
}

function canAccessTask(user, task) {
  return !!task && (task.ownerId === user.id || (task.members || []).includes(user.id))
}

function insertEntry(state, user, payload, flags = {}) {
  const task = ensureTask(state, user, payload)
  const date = payload.date || state.todayKey
  const start = Number(payload.start ?? (() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes() - Math.max(1, Math.round((payload.durationSeconds || 60) / 60))
  })())
  const dur = Math.max(1, Number(payload.dur || Math.round((payload.durationSeconds || 60) / 60)))
  const entry = {
    id: payload.id || newId('e'),
    taskId: task.id,
    userId: user.id,
    date,
    dow: dowOf(date),
    start,
    dur,
    durationSeconds: dur * 60,
    isManual: !!flags.manual,
    isEdited: !!flags.edited,
    idleSeconds: Number(payload.idleSeconds || 0),
    contextSwitches: Number(payload.contextSwitches || 0),
    locationLabel: payload.locationLabel || '',
    estimateMinutes: task.estimateMinutes || payload.estimateMinutes || 0,
    feedback: payload.feedback || null,
    blockers: payload.blockers || [],
    _draftTitle: payload._draftTitle || '',
    _draftCat: payload._draftCat || task.categoryId || '',
  }
  state.entries.push(entry)
  return entry
}

function exportRows(state, user) {
  return state.entries.filter((entry) => entry.userId === user.id).map((entry) => {
    const task = state.tasks.find((item) => item.id === entry.taskId) || {}
    const cat = state.categories.find((item) => item.id === task.categoryId) || {}
    const client = state.clients.find((item) => item.id === task.clientId) || {}
    const project = state.projects.find((item) => item.id === task.projectId) || {}
    return {
      date: entry.date,
      task: task.title || entry._draftTitle || 'Task',
      category: cat.name || '',
      client: client.name || '',
      project: project.name || '',
      duration_minutes: entry.dur,
      idle_seconds: entry.idleSeconds,
      context_switches: entry.contextSwitches,
      location: entry.locationLabel,
      manual: entry.isManual,
      edited: entry.isEdited,
      flow: entry.feedback?.flowQuality || '',
      efficiency: entry.feedback?.efficiencyFeel || '',
      energy: entry.feedback?.energy || '',
      note: entry.feedback?.note || '',
      blockers: (entry.blockers || []).map((id) => state.blockerDefs.find((item) => item.id === id)?.name || id).join('; '),
    }
  })
}

function csvEscape(value) {
  const textValue = String(value ?? '')
  return /[",\n]/.test(textValue) ? `"${textValue.replace(/"/g, '""')}"` : textValue
}

async function handleMockApi(path, init = {}) {
  const method = (init.method || 'GET').toUpperCase()
  const state = loadState()

  if (method === 'POST' && path === '/api/auth/signin') {
    const input = await readBody(init)
    const email = String(input.email || '').trim().toLowerCase()
    const user = state.users.find((item) => item.email === email)
    if (!user || String(input.password || '') !== 'breezy123') {
      return json({ error: 'Invalid email or password. Demo password is breezy123.' }, 401)
    }
    user.lastSignedInAt = nowIso()
    const token = TOKEN_PREFIX + user.id + '-' + Math.random().toString(36).slice(2)
    state.sessions[token] = user.id
    saveState(state)
    return json({ token, user: publicUser(user), bootstrap: bootstrap(state, user) })
  }

  if (method === 'POST' && path === '/api/auth/signup') {
    const input = await readBody(init)
    const email = String(input.email || '').trim().toLowerCase()
    if (!email.endsWith('@airgradient.com')) return json({ error: 'Use an AirGradient email.' }, 403)
    if (state.users.some((user) => user.email === email)) return json({ error: 'Account already exists.' }, 409)
    const user = { id: newId('u'), email, name: input.name || email.split('@')[0], team: input.team || 'Software', lastSignedInAt: nowIso() }
    const token = TOKEN_PREFIX + user.id + '-' + Math.random().toString(36).slice(2)
    state.users.push(user)
    state.settingsByUser[user.id] = defaultSettings()
    state.sessions[token] = user.id
    saveState(state)
    return json({ token, user: publicUser(user), bootstrap: bootstrap(state, user) })
  }

  if (method === 'POST' && path === '/api/auth/signout') return json({ ok: true })

  const auth = requireUser(state, init)
  if (auth.error) return auth.error
  const user = auth.user

  if (method === 'GET' && path === '/api/bootstrap') return json(bootstrap(state, user))

  if (method === 'POST' && path === '/api/timer/start') {
    const input = await readBody(init)
    if (input.taskId && input.taskId !== 'draft' && !canAccessTask(user, state.tasks.find((task) => task.id === input.taskId))) {
      return json({ error: 'You are not a collaborator on this task.' }, 403)
    }
    const task = ensureTask(state, user, input)
    const session = {
      id: newId('s'),
      taskId: task.id,
      userId: user.id,
      title: input.title || task.title,
      categoryId: input.categoryId || task.categoryId,
      startedAt: Date.now(),
    }
    state.activeSessions.push(session)
    saveState(state)
    return json({ activeSessionId: session.id, taskId: task.id, task })
  }

  if (method === 'POST' && path === '/api/timer/stop') {
    const input = await readBody(init)
    const index = state.activeSessions.findIndex((session) => session.id === input.activeSessionId && session.userId === user.id)
    if (index < 0) return json({ error: 'Active session not found.' }, 404)
    const [session] = state.activeSessions.splice(index, 1)
    const started = new Date(session.startedAt)
    const entry = insertEntry(state, user, {
      taskId: session.taskId,
      title: session.title,
      categoryId: session.categoryId,
      date: dateKey(started),
      start: started.getHours() * 60 + started.getMinutes(),
      dur: Math.max(1, Math.round(Number(input.durationSeconds || 60) / 60)),
      idleSeconds: input.idleSeconds,
      contextSwitches: input.contextSwitches,
      locationLabel: input.locationLabel,
    })
    saveState(state)
    return json({ entry, bootstrap: bootstrap(state, user) })
  }

  if (method === 'POST' && path === '/api/manual-entry') {
    const input = await readBody(init)
    if (!input.title && !input.taskId) return json({ error: 'Task is required.' }, 400)
    if (Number(input.dur || 0) <= 0) return json({ error: 'Duration must be greater than zero.' }, 400)
    if (input.taskId && input.taskId !== 'draft' && !canAccessTask(user, state.tasks.find((task) => task.id === input.taskId))) {
      return json({ error: 'You are not a collaborator on this task.' }, 403)
    }
    const entry = insertEntry(state, user, input, { manual: true })
    saveState(state)
    return json({ entry, bootstrap: bootstrap(state, user) })
  }

  if (method === 'PATCH' && path.startsWith('/api/entries/')) {
    const id = path.split('/').pop()
    const input = await readBody(init)
    const entry = state.entries.find((item) => item.id === id && item.userId === user.id)
    if (!entry) return json({ error: 'Entry not found.' }, 404)
    if (input.feedback !== undefined || input.blockers !== undefined) {
      entry.feedback = input.feedback || null
      entry.blockers = input.blockers || []
    } else {
      Object.assign(entry, {
        date: input.date || entry.date,
        dow: dowOf(input.date || entry.date),
        start: Number(input.start ?? entry.start),
        dur: Math.max(1, Number(input.dur ?? entry.dur)),
        idleSeconds: Number(input.idleSeconds ?? entry.idleSeconds),
        contextSwitches: Number(input.contextSwitches ?? entry.contextSwitches),
        locationLabel: input.locationLabel ?? entry.locationLabel,
      })
      entry.durationSeconds = entry.dur * 60
    }
    entry.isEdited = true
    saveState(state)
    return json({ entry, bootstrap: bootstrap(state, user) })
  }

  if (method === 'DELETE' && path.startsWith('/api/entries/')) {
    const id = path.split('/').pop()
    state.entries = state.entries.filter((entry) => !(entry.id === id && entry.userId === user.id))
    saveState(state)
    return json({ ok: true, bootstrap: bootstrap(state, user) })
  }

  if (method === 'POST' && path === '/api/categories') {
    const input = await readBody(init)
    const colors = ['#1C75BC', '#FC7E10', '#7a59c6', '#2aa6a0', '#c2418f', '#e0a008']
    const category = { id: newId('c'), name: input.name, icon: 'other', color: colors[Math.floor(Math.random() * colors.length)], ownerId: user.id }
    state.categories.push(category)
    saveState(state)
    return json({ category, bootstrap: bootstrap(state, user) })
  }

  if (method === 'PATCH' && path === '/api/profile') {
    const input = await readBody(init)
    user.name = input.name || user.name
    user.team = input.team || user.team
    saveState(state)
    return json({ bootstrap: bootstrap(state, user) })
  }

  if (method === 'PATCH' && path === '/api/settings') {
    const input = await readBody(init)
    state.settingsByUser[user.id] = input
    saveState(state)
    return json({ bootstrap: bootstrap(state, user) })
  }

  if (method === 'GET' && path === '/api/members') {
    return json({ members: state.users.filter((item) => item.id !== user.id && item.lastSignedInAt).map(publicUser) })
  }

  const shareMatch = path.match(/^\/api\/tasks\/([^/]+)\/share$/)
  if (method === 'POST' && shareMatch) {
    const input = await readBody(init)
    const task = state.tasks.find((item) => item.id === shareMatch[1])
    if (!task) return json({ error: 'Task not found.' }, 404)
    if (task.ownerId !== user.id) return json({ error: 'Only the task owner can invite collaborators.' }, 403)
    const member = state.users.find((item) => item.id === input.userId && item.lastSignedInAt)
    if (!member) return json({ error: 'Invite a signed-in user.' }, 400)
    task.isShared = true
    task.members = [...new Set([...(task.members || []), task.ownerId, member.id])]
    saveState(state)
    return json({ bootstrap: bootstrap(state, user) })
  }

  if (method === 'GET' && path.startsWith('/api/export')) {
    const format = new URL(path, 'http://standalone.local').searchParams.get('format') === 'json' ? 'json' : 'csv'
    const rows = exportRows(state, user)
    if (format === 'json') return text(JSON.stringify(rows, null, 2), 'application/json', 'breezy-export.json')
    const cols = Object.keys(rows[0] || { date: '' })
    const csv = [cols.join(','), ...rows.map((row) => cols.map((col) => csvEscape(row[col])).join(','))].join('\n')
    return text(csv, 'text/csv', 'breezy-export.csv')
  }

  return json({ error: 'Not found' }, 404)
}

function apiPathFromInput(input) {
  const rawUrl = typeof input === 'string' ? input : input.url
  if (rawUrl.startsWith('/api/')) return rawUrl
  const url = new URL(rawUrl, window.location.href)
  if (url.pathname.startsWith('/api/')) return url.pathname + url.search
  const apiAt = url.pathname.indexOf('/api/')
  if (apiAt >= 0) return url.pathname.slice(apiAt) + url.search
  return ''
}

window.__agMockFetch = async (input, init = {}) => {
  const apiPath = apiPathFromInput(input)
  if (apiPath) return handleMockApi(apiPath, init)
  return nativeFetch(input, init)
}

window.__AG_STANDALONE__ = true
window.fetch = window.__agMockFetch
