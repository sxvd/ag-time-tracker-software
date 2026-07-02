import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const dbPath = process.env.AG_DB_PATH || join(root, 'data', 'time-tracker.sqlite')
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON')

const json = (value, fallback) => {
  if (value == null || value === '') return fallback
  try { return JSON.parse(value) } catch { return fallback }
}

export const hashPassword = (email, password) =>
  createHash('sha256').update(`${email.toLowerCase()}:ag-demo-salt:${password}`).digest('hex')

export const makeToken = () => randomBytes(32).toString('hex')
const tokenHash = (token) => createHash('sha256').update(token).digest('hex')
export const hashToken = tokenHash

function loadMock() {
  const code = readFileSync(join(root, 'src', 'domain', 'data.js'), 'utf8')
  const sandbox = { window: {} }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox.window.AG
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      team TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_signed_in_at TEXT
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      owner_id TEXT REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      client_id TEXT REFERENCES clients(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category_id TEXT REFERENCES categories(id),
      client_id TEXT REFERENCES clients(id),
      project_id TEXT REFERENCES projects(id),
      estimate_minutes INTEGER DEFAULT 0,
      owner_id TEXT NOT NULL REFERENCES users(id),
      is_shared INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_members (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by_user_id TEXT REFERENCES users(id),
      joined_at TEXT NOT NULL,
      PRIMARY KEY (task_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS active_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      category_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      paused_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tracking_presence (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      active_session_id TEXT REFERENCES active_sessions(id) ON DELETE SET NULL,
      heartbeat_at TEXT NOT NULL,
      PRIMARY KEY (user_id, task_id)
    );
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      date TEXT NOT NULL,
      dow INTEGER NOT NULL,
      start INTEGER NOT NULL,
      dur INTEGER NOT NULL,
      duration_seconds INTEGER NOT NULL,
      is_manual INTEGER NOT NULL DEFAULT 0,
      is_edited INTEGER NOT NULL DEFAULT 0,
      idle_seconds INTEGER NOT NULL DEFAULT 0,
      context_switches INTEGER NOT NULL DEFAULT 0,
      location_label TEXT DEFAULT '',
      estimate_minutes INTEGER DEFAULT 0,
      feedback_json TEXT,
      blockers_json TEXT NOT NULL DEFAULT '[]',
      draft_title TEXT DEFAULT '',
      draft_cat TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_time_entries_user_started ON time_entries(user_id, date, start);
    CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS breezy_days (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      hours REAL NOT NULL,
      air_clarity INTEGER NOT NULL,
      mood TEXT NOT NULL,
      great INTEGER NOT NULL,
      blocked INTEGER NOT NULL,
      PRIMARY KEY (user_id, date)
    );
    CREATE TABLE IF NOT EXISTS medals (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      medal_group TEXT NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_medals (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      medal_code TEXT NOT NULL REFERENCES medals(code) ON DELETE CASCADE,
      awarded_at TEXT NOT NULL,
      PRIMARY KEY (user_id, medal_code)
    );
  `)
}

function insert(table, row) {
  const keys = Object.keys(row)
  const cols = keys.join(', ')
  const params = keys.map((k) => `:${k}`).join(', ')
  db.prepare(`INSERT OR IGNORE INTO ${table} (${cols}) VALUES (${params})`).run(row)
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function moodForClarity(c) {
  if (c >= 85) return 'happy'
  if (c >= 70) return 'engineer'
  if (c >= 55) return 'focused'
  if (c >= 40) return 'thinking'
  if (c >= 25) return 'haze-low'
  return 'haze-high'
}

export function recomputeBreezyDays(userId) {
  const rows = db.prepare('SELECT * FROM time_entries WHERE user_id = ?').all(userId)
  const byDate = new Map()
  for (const e of rows) {
    const list = byDate.get(e.date) || []
    list.push(e)
    byDate.set(e.date, list)
  }
  db.prepare('DELETE FROM breezy_days WHERE user_id = ?').run(userId)
  const stmt = db.prepare(`INSERT INTO breezy_days
    (user_id, date, hours, air_clarity, mood, great, blocked)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
  for (const [date, entries] of byDate) {
    const mins = entries.reduce((sum, e) => sum + e.dur, 0)
    const great = entries.filter((e) => json(e.feedback_json, null)?.flowQuality === 'Great flow').length
    const blocked = entries.filter((e) => json(e.blockers_json, []).filter((b) => b !== 'none').length > 0).length
    const hours = +(mins / 60).toFixed(1)
    const clarity = Math.max(12, Math.min(100, Math.round((hours / 7) * 55 + great * 14 - blocked * 8 + 30)))
    stmt.run(userId, date, hours, clarity, moodForClarity(clarity), great, blocked)
  }
}

export function seedIfNeeded() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM time_entries').get().count
  if (count > 0) return
  db.exec(`
    DELETE FROM user_medals;
    DELETE FROM medals;
    DELETE FROM breezy_days;
    DELETE FROM settings;
    DELETE FROM time_entries;
    DELETE FROM tracking_presence;
    DELETE FROM active_sessions;
    DELETE FROM task_members;
    DELETE FROM tasks;
    DELETE FROM projects;
    DELETE FROM clients;
    DELETE FROM categories;
    DELETE FROM auth_sessions;
    DELETE FROM users;
  `)
  const AG = loadMock()
  const now = new Date().toISOString()
  for (const u of AG.users) {
    insert('users', {
      id: u.id,
      email: u.email.toLowerCase(),
      display_name: u.name,
      password_hash: hashPassword(u.email, 'breezy123'),
      team: u.team,
      created_at: now,
      last_signed_in_at: now,
    })
  }
  for (const c of AG.categories) insert('categories', { ...c, owner_id: null })
  for (const c of AG.clients) insert('clients', c)
  for (const p of AG.projects) insert('projects', { id: p.id, client_id: p.clientId, name: p.name, description: '' })
  for (const t of AG.tasks) {
    insert('tasks', {
      id: t.id,
      title: t.title,
      description: '',
      category_id: t.categoryId,
      client_id: t.clientId,
      project_id: t.projectId,
      estimate_minutes: t.estimateMinutes || 0,
      owner_id: t.ownerId,
      is_shared: t.isShared ? 1 : 0,
      is_archived: 0,
      created_at: now,
    })
    insert('task_members', { task_id: t.id, user_id: t.ownerId, role: 'owner', invited_by_user_id: t.ownerId, joined_at: now })
    for (const uid of t.members || []) {
      insert('task_members', { task_id: t.id, user_id: uid, role: uid === t.ownerId ? 'owner' : 'member', invited_by_user_id: t.ownerId, joined_at: now })
    }
  }
  for (const e of AG.entries) {
    insert('time_entries', {
      id: e.id,
      task_id: e.taskId,
      user_id: e.userId,
      date: e.date,
      dow: e.dow,
      start: e.start,
      dur: e.dur,
      duration_seconds: e.durationSeconds,
      is_manual: e.isManual ? 1 : 0,
      is_edited: 0,
      idle_seconds: e.idleSeconds || 0,
      context_switches: e.contextSwitches || 0,
      location_label: e.locationLabel || '',
      estimate_minutes: e.estimateMinutes || 0,
      feedback_json: e.feedback ? JSON.stringify(e.feedback) : null,
      blockers_json: JSON.stringify(e.blockers || []),
      draft_title: e._draftTitle || '',
      draft_cat: e._draftCat || '',
      created_at: now,
      updated_at: now,
    })
  }
  for (const m of AG.medals) {
    insert('medals', { code: m.code, name: m.name, emoji: m.emoji, medal_group: m.group, description: m.desc })
    if (m.earned) insert('user_medals', { user_id: 'u1', medal_code: m.code, awarded_at: now })
  }
  for (const u of AG.users) {
    insert('settings', { user_id: u.id, json: JSON.stringify(AG.settings) })
    recomputeBreezyDays(u.id)
  }
}

export function initDb() {
  migrate()
  seedIfNeeded()
}

export function getSessionUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const row = db.prepare(`
    SELECT u.* FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
  `).get(tokenHash(token), new Date().toISOString())
  return row || null
}

export function publicUser(row) {
  return { id: row.id, email: row.email, name: row.display_name, team: row.team }
}

export function serializeBootstrap(user) {
  const users = db.prepare('SELECT * FROM users ORDER BY display_name').all().map(publicUser)
  const categories = db.prepare('SELECT id, name, icon, color, owner_id AS ownerId FROM categories ORDER BY rowid').all()
  const clients = db.prepare('SELECT id, name FROM clients ORDER BY rowid').all()
  const projects = db.prepare('SELECT id, client_id AS clientId, name, description FROM projects ORDER BY rowid').all()
  const tasks = db.prepare(`
    SELECT id, title, description, category_id AS categoryId, client_id AS clientId, project_id AS projectId,
      estimate_minutes AS estimateMinutes, owner_id AS ownerId, is_shared AS isShared, is_archived AS isArchived
    FROM tasks WHERE is_archived = 0 ORDER BY rowid
  `).all().map((t) => ({
    ...t,
    isShared: !!t.isShared,
    isArchived: !!t.isArchived,
    members: db.prepare('SELECT user_id FROM task_members WHERE task_id = ? ORDER BY joined_at').all(t.id).map((m) => m.user_id),
  }))
  const entries = db.prepare('SELECT * FROM time_entries ORDER BY date, start').all().map((e) => ({
    id: e.id,
    taskId: e.task_id,
    userId: e.user_id,
    date: e.date,
    dow: e.dow,
    start: e.start,
    dur: e.dur,
    durationSeconds: e.duration_seconds,
    isManual: !!e.is_manual,
    isEdited: !!e.is_edited,
    idleSeconds: e.idle_seconds,
    contextSwitches: e.context_switches,
    locationLabel: e.location_label,
    estimateMinutes: e.estimate_minutes,
    feedback: json(e.feedback_json, null),
    blockers: json(e.blockers_json, []),
    _draftTitle: e.draft_title,
    _draftCat: e.draft_cat,
  }))
  const blockerDefs = [
    { id: 'wait', name: 'Waiting on someone' },
    { id: 'tool', name: 'Tool was slow or broke' },
    { id: 'unclear', name: 'Unclear requirements' },
    { id: 'interrupt', name: 'Interruptions' },
    { id: 'ctxsw', name: 'Context switching' },
    { id: 'meeting', name: 'Meetings overran' },
    { id: 'none', name: 'None' },
  ]
  const medalRows = db.prepare(`
    SELECT m.code, m.name, m.emoji, m.medal_group AS "group", m.description AS "desc",
      CASE WHEN um.medal_code IS NULL THEN 0 ELSE 1 END AS earned
    FROM medals m LEFT JOIN user_medals um ON um.medal_code = m.code AND um.user_id = ?
  `).all(user.id).map((m) => ({ ...m, earned: !!m.earned }))
  const breezyDays = {}
  for (const bd of db.prepare('SELECT * FROM breezy_days WHERE user_id = ?').all(user.id)) {
    breezyDays[bd.date] = { date: bd.date, hours: bd.hours, airClarity: bd.air_clarity, mood: bd.mood, great: bd.great, blocked: bd.blocked }
  }
  const settingsRow = db.prepare('SELECT json FROM settings WHERE user_id = ?').get(user.id)
  const TODAY = new Date(2026, 5, 10)
  return {
    TODAY_KEY: dateKey(TODAY),
    categories,
    teams: ['COMMS', 'Hardware', 'Software', 'Design'],
    users,
    clients,
    projects,
    tasks,
    entries,
    blockerDefs,
    medals: medalRows,
    breezyDays,
    me: publicUser(user),
    company: { name: 'AirGradient', size: users.length },
    settings: settingsRow ? json(settingsRow.json, {}) : {},
    FLOW: ['Great flow', 'Neutral', 'Friction'],
    EFF: ['Felt efficient', 'Felt manual', 'Felt wasteful'],
    ENERGY: ['High', 'OK', 'Drained'],
  }
}

initDb()
