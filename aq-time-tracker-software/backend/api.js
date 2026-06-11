import { readFileSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, getSessionUser, hashPassword, hashToken, makeToken, publicUser, recomputeBreezyDays, serializeBootstrap } from './db.js'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))

function send(res, status, data, headers = {}) {
  res.statusCode = status
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  if (Buffer.isBuffer(data) || typeof data === 'string') return res.end(data)
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(data))
}

async function body(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const nowIso = () => new Date().toISOString()
const newId = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dowOf = (key) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function requireUser(req, res) {
  const user = getSessionUser(req)
  if (!user) {
    send(res, 401, { error: 'Please sign in again.' })
    return null
  }
  return user
}

function taskForEntry(taskId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
}

function ensureTaskForUser(user, draft) {
  if (draft.taskId && draft.taskId !== 'draft') {
    const task = taskForEntry(draft.taskId)
    if (task) return task
  }
  const id = newId('t')
  const categoryId = draft.categoryId || draft._draftCat || 'deep'
  db.prepare(`INSERT INTO tasks
    (id, title, description, category_id, client_id, project_id, estimate_minutes, owner_id, is_shared, is_archived, created_at)
    VALUES (?, ?, '', ?, NULL, NULL, ?, ?, 0, 0, ?)`)
    .run(id, draft.title || draft._draftTitle || 'Untitled task', categoryId, Number(draft.estimateMinutes || 0), user.id, nowIso())
  db.prepare('INSERT INTO task_members (task_id, user_id, role, invited_by_user_id, joined_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, user.id, 'owner', user.id, nowIso())
  return taskForEntry(id)
}

function entryFromRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    date: row.date,
    dow: row.dow,
    start: row.start,
    dur: row.dur,
    durationSeconds: row.duration_seconds,
    isManual: !!row.is_manual,
    isEdited: !!row.is_edited,
    idleSeconds: row.idle_seconds,
    contextSwitches: row.context_switches,
    locationLabel: row.location_label,
    estimateMinutes: row.estimate_minutes,
    feedback: row.feedback_json ? JSON.parse(row.feedback_json) : null,
    blockers: row.blockers_json ? JSON.parse(row.blockers_json) : [],
    _draftTitle: row.draft_title,
    _draftCat: row.draft_cat,
  }
}

function insertEntry(user, payload, flags = {}) {
  const task = ensureTaskForUser(user, payload)
  const date = payload.date || dateKey(new Date())
  const start = Number(payload.start ?? (() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes() - Math.max(1, Math.round((payload.durationSeconds || 60) / 60))
  })())
  const dur = Math.max(1, Number(payload.dur || Math.round((payload.durationSeconds || 60) / 60)))
  const id = payload.id || newId('e')
  db.prepare(`INSERT INTO time_entries
    (id, task_id, user_id, date, dow, start, dur, duration_seconds, is_manual, is_edited,
      idle_seconds, context_switches, location_label, estimate_minutes, feedback_json, blockers_json,
      draft_title, draft_cat, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id,
      task.id,
      user.id,
      date,
      dowOf(date),
      start,
      dur,
      dur * 60,
      flags.manual ? 1 : 0,
      flags.edited ? 1 : 0,
      Number(payload.idleSeconds || 0),
      Number(payload.contextSwitches || 0),
      payload.locationLabel || '',
      task.estimate_minutes || payload.estimateMinutes || 0,
      payload.feedback ? JSON.stringify(payload.feedback) : null,
      JSON.stringify(payload.blockers || []),
      payload._draftTitle || '',
      payload._draftCat || task.category_id || '',
      nowIso(),
      nowIso(),
    )
  recomputeBreezyDays(user.id)
  return entryFromRow(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id))
}

function userCanAccessTask(userId, taskId) {
  return !!db.prepare('SELECT 1 FROM task_members WHERE task_id = ? AND user_id = ?').get(taskId, userId)
}

function requestedTaskDenied(user, input) {
  return input.taskId && input.taskId !== 'draft' && !userCanAccessTask(user.id, input.taskId)
}

export async function handleApi(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const method = req.method || 'GET'

  if (method === 'POST' && url.pathname === '/api/auth/signin') {
    const input = await body(req)
    const email = String(input.email || '').trim().toLowerCase()
    if (!email.endsWith('@airgradient.com')) return send(res, 403, { error: 'Use an AirGradient email.' })
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user || user.password_hash !== hashPassword(email, String(input.password || ''))) return send(res, 401, { error: 'Invalid email or password.' })
    const token = makeToken()
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString()
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), user.id, nowIso(), expires)
    db.prepare('UPDATE users SET last_signed_in_at = ? WHERE id = ?').run(nowIso(), user.id)
    return send(res, 200, { token, user: publicUser(user), bootstrap: serializeBootstrap(user) })
  }

  if (method === 'POST' && url.pathname === '/api/auth/signup') {
    const input = await body(req)
    const email = String(input.email || '').trim().toLowerCase()
    if (!email.endsWith('@airgradient.com')) return send(res, 403, { error: 'Use an AirGradient email.' })
    if (!input.password || String(input.password).length < 6) return send(res, 400, { error: 'Password must be at least 6 characters.' })
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return send(res, 409, { error: 'Account already exists.' })
    const id = newId('u')
    db.prepare('INSERT INTO users (id, email, display_name, password_hash, team, created_at, last_signed_in_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, email, input.name || email.split('@')[0], hashPassword(email, input.password), input.team || 'Software', nowIso(), nowIso())
    db.prepare('INSERT INTO settings (user_id, json) VALUES (?, ?)').run(id, JSON.stringify({ idleThreshold: 5, nudgeCadence: 90, verbosity: 'gentle', muted: false, theme: 'light', locationEnabled: false }))
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    const token = makeToken()
    db.prepare('INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), id, nowIso(), new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString())
    return send(res, 200, { token, user: publicUser(user), bootstrap: serializeBootstrap(user) })
  }

  if (method === 'POST' && url.pathname === '/api/auth/signout') {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (token) db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?').run(nowIso(), hashToken(token))
    return send(res, 200, { ok: true })
  }

  const user = requireUser(req, res)
  if (!user) return

  if (method === 'GET' && url.pathname === '/api/bootstrap') return send(res, 200, serializeBootstrap(user))

  if (method === 'POST' && url.pathname === '/api/timer/start') {
    const input = await body(req)
    if (requestedTaskDenied(user, input)) return send(res, 403, { error: 'You are not a collaborator on this task.' })
    const task = ensureTaskForUser(user, input)
    const sessionId = newId('s')
    db.prepare('INSERT INTO active_sessions (id, task_id, user_id, title, category_id, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(sessionId, task.id, user.id, input.title || task.title, input.categoryId || task.category_id, nowIso(), nowIso())
    db.prepare('INSERT OR REPLACE INTO tracking_presence (user_id, task_id, active_session_id, heartbeat_at) VALUES (?, ?, ?, ?)')
      .run(user.id, task.id, sessionId, nowIso())
    return send(res, 200, { activeSessionId: sessionId, taskId: task.id, task: serializeBootstrap(user).tasks.find((t) => t.id === task.id) })
  }

  if (method === 'POST' && url.pathname === '/api/timer/stop') {
    const input = await body(req)
    const active = db.prepare('SELECT * FROM active_sessions WHERE id = ? AND user_id = ?').get(input.activeSessionId, user.id)
    if (!active) return send(res, 404, { error: 'Active session not found.' })
    const started = new Date(active.started_at)
    const mins = Math.max(1, Math.round(Number(input.durationSeconds || 60) / 60))
    const entry = insertEntry(user, {
      taskId: active.task_id,
      title: active.title,
      categoryId: active.category_id,
      date: dateKey(started),
      start: started.getHours() * 60 + started.getMinutes(),
      dur: mins,
      idleSeconds: input.idleSeconds,
      contextSwitches: input.contextSwitches,
      locationLabel: input.locationLabel,
    })
    db.prepare('DELETE FROM active_sessions WHERE id = ?').run(active.id)
    db.prepare('DELETE FROM tracking_presence WHERE active_session_id = ?').run(active.id)
    return send(res, 200, { entry, bootstrap: serializeBootstrap(user) })
  }

  if (method === 'POST' && url.pathname === '/api/manual-entry') {
    const input = await body(req)
    if (!input.title && !input.taskId) return send(res, 400, { error: 'Task is required.' })
    if (Number(input.dur || 0) <= 0) return send(res, 400, { error: 'Duration must be greater than zero.' })
    if (requestedTaskDenied(user, input)) return send(res, 403, { error: 'You are not a collaborator on this task.' })
    const entry = insertEntry(user, input, { manual: true })
    return send(res, 200, { entry, bootstrap: serializeBootstrap(user) })
  }

  if (method === 'PATCH' && url.pathname.startsWith('/api/entries/')) {
    const id = url.pathname.split('/').pop()
    const input = await body(req)
    const entry = db.prepare('SELECT * FROM time_entries WHERE id = ? AND user_id = ?').get(id, user.id)
    if (!entry) return send(res, 404, { error: 'Entry not found.' })
    if (input.feedback !== undefined || input.blockers !== undefined) {
      db.prepare('UPDATE time_entries SET feedback_json = ?, blockers_json = ?, is_edited = 1, updated_at = ? WHERE id = ?')
        .run(input.feedback ? JSON.stringify(input.feedback) : null, JSON.stringify(input.blockers || []), nowIso(), id)
    } else {
      const dur = Math.max(1, Number(input.dur ?? entry.dur))
      db.prepare(`UPDATE time_entries SET date = ?, dow = ?, start = ?, dur = ?, duration_seconds = ?,
        idle_seconds = ?, context_switches = ?, location_label = ?, is_edited = 1, updated_at = ? WHERE id = ?`)
        .run(input.date || entry.date, dowOf(input.date || entry.date), Number(input.start ?? entry.start), dur, dur * 60,
          Number(input.idleSeconds ?? entry.idle_seconds), Number(input.contextSwitches ?? entry.context_switches), input.locationLabel ?? entry.location_label, nowIso(), id)
    }
    recomputeBreezyDays(user.id)
    return send(res, 200, { entry: entryFromRow(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id)), bootstrap: serializeBootstrap(user) })
  }

  if (method === 'DELETE' && url.pathname.startsWith('/api/entries/')) {
    const id = url.pathname.split('/').pop()
    db.prepare('DELETE FROM time_entries WHERE id = ? AND user_id = ?').run(id, user.id)
    recomputeBreezyDays(user.id)
    return send(res, 200, { ok: true, bootstrap: serializeBootstrap(user) })
  }

  if (method === 'POST' && url.pathname === '/api/categories') {
    const input = await body(req)
    const id = newId('c')
    const colors = ['#1C75BC', '#FC7E10', '#7a59c6', '#2aa6a0', '#c2418f', '#e0a008']
    db.prepare('INSERT INTO categories (id, name, icon, color, owner_id) VALUES (?, ?, ?, ?, ?)')
      .run(id, input.name, 'other', colors[Math.floor(Math.random() * colors.length)], user.id)
    return send(res, 200, { category: db.prepare('SELECT id, name, icon, color FROM categories WHERE id = ?').get(id), bootstrap: serializeBootstrap(user) })
  }

  if (method === 'PATCH' && url.pathname === '/api/profile') {
    const input = await body(req)
    db.prepare('UPDATE users SET display_name = ?, team = ? WHERE id = ?').run(input.name || user.display_name, input.team || user.team, user.id)
    return send(res, 200, { bootstrap: serializeBootstrap(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) })
  }

  if (method === 'PATCH' && url.pathname === '/api/settings') {
    const input = await body(req)
    db.prepare('INSERT OR REPLACE INTO settings (user_id, json) VALUES (?, ?)').run(user.id, JSON.stringify(input))
    return send(res, 200, { bootstrap: serializeBootstrap(user) })
  }

  if (method === 'GET' && url.pathname === '/api/members') {
    const members = db.prepare('SELECT * FROM users WHERE last_signed_in_at IS NOT NULL AND id <> ? ORDER BY display_name').all(user.id).map(publicUser)
    return send(res, 200, { members })
  }

  if (method === 'POST' && url.pathname.match(/^\/api\/tasks\/[^/]+\/share$/)) {
    const taskId = url.pathname.split('/')[3]
    const input = await body(req)
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId)
    if (!task) return send(res, 404, { error: 'Task not found.' })
    if (task.owner_id !== user.id) return send(res, 403, { error: 'Only the task owner can invite collaborators.' })
    const member = db.prepare('SELECT * FROM users WHERE id = ? AND last_signed_in_at IS NOT NULL').get(input.userId)
    if (!member) return send(res, 400, { error: 'Invite a signed-in user.' })
    db.prepare('UPDATE tasks SET is_shared = 1 WHERE id = ?').run(taskId)
    db.prepare('INSERT OR IGNORE INTO task_members (task_id, user_id, role, invited_by_user_id, joined_at) VALUES (?, ?, ?, ?, ?)')
      .run(taskId, member.id, 'member', user.id, nowIso())
    return send(res, 200, { bootstrap: serializeBootstrap(user) })
  }

  if (method === 'GET' && url.pathname === '/api/export') {
    const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv'
    const bootstrap = serializeBootstrap(user)
    const rows = bootstrap.entries.filter((e) => e.userId === user.id).map((e) => {
      const task = bootstrap.tasks.find((t) => t.id === e.taskId) || {}
      const cat = bootstrap.categories.find((c) => c.id === task.categoryId) || {}
      const client = bootstrap.clients.find((c) => c.id === task.clientId) || {}
      const project = bootstrap.projects.find((p) => p.id === task.projectId) || {}
      return {
        date: e.date,
        task: task.title || e._draftTitle || 'Task',
        category: cat.name || '',
        client: client.name || '',
        project: project.name || '',
        duration_minutes: e.dur,
        idle_seconds: e.idleSeconds,
        context_switches: e.contextSwitches,
        location: e.locationLabel,
        manual: e.isManual,
        edited: e.isEdited,
        flow: e.feedback?.flowQuality || '',
        efficiency: e.feedback?.efficiencyFeel || '',
        energy: e.feedback?.energy || '',
        note: e.feedback?.note || '',
        blockers: e.blockers.map((b) => bootstrap.blockerDefs.find((x) => x.id === b)?.name || b).join('; '),
      }
    })
    if (format === 'json') return send(res, 200, JSON.stringify(rows, null, 2), { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="breezy-export.json"' })
    const cols = Object.keys(rows[0] || { date: '' })
    const esc = (value) => {
      const text = String(value ?? '')
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }
    const csv = [cols.join(','), ...rows.map((row) => cols.map((col) => esc(row[col])).join(','))].join('\n')
    return send(res, 200, csv, { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="breezy-export.csv"' })
  }

  return send(res, 404, { error: 'Not found' })
}

export function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  const candidates = [join(root, 'dist', file), join(root, 'public', file), join(root, file)]
  const path = candidates.find((candidate) => {
    try { return statSync(candidate).isFile() } catch { return false }
  })
  if (!path) return send(res, 404, 'Not found', { 'content-type': 'text/plain' })
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }
  return send(res, 200, readFileSync(path), { 'content-type': types[extname(path)] || 'application/octet-stream' })
}
