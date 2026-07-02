import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

process.env.AG_DB_PATH = join(mkdtempSync(join(tmpdir(), 'ag-time-tracker-')), 'test.sqlite')
const { handleApi } = await import('../backend/api.js')

function startServer() {
  const server = createServer((req, res) => handleApi(req, res))
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, base: `http://127.0.0.1:${port}` })
    })
  })
}

async function signIn(base, email = 'maya@airgradient.com') {
  const res = await fetch(`${base}/api/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'breezy123' }),
  })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.ok(data.token)
  return data.token
}

test('database-backed auth, tracking, share, feedback, manual entry, and export flow', async () => {
  const { server, base } = await startServer()
  try {
    const token = await signIn(base)
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

    const boot = await fetch(`${base}/api/bootstrap`, { headers }).then((r) => r.json())
    assert.equal(boot.users.length, 6)
    assert.ok(boot.entries.length >= 500)

    const start = await fetch(`${base}/api/timer/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Integration task', categoryId: 'deep' }),
    }).then((r) => r.json())
    assert.ok(start.activeSessionId)
    assert.ok(start.taskId)

    const members = await fetch(`${base}/api/members`, { headers }).then((r) => r.json())
    assert.ok(members.members.length > 0)

    const shared = await fetch(`${base}/api/tasks/${start.taskId}/share`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: members.members[0].id }),
    }).then((r) => r.json())
    assert.equal(shared.bootstrap.tasks.find((t) => t.id === start.taskId).members.length, 2)

    const collabToken = await signIn(base, members.members[0].email)
    const collabHeaders = { authorization: `Bearer ${collabToken}`, 'content-type': 'application/json' }
    const collabBoot = await fetch(`${base}/api/bootstrap`, { headers: collabHeaders }).then((r) => r.json())
    assert.ok(collabBoot.tasks.find((t) => t.id === start.taskId).members.includes(members.members[0].id))

    const collabStart = await fetch(`${base}/api/timer/start`, {
      method: 'POST',
      headers: collabHeaders,
      body: JSON.stringify({ taskId: start.taskId, title: 'Integration task', categoryId: 'deep' }),
    }).then((r) => r.json())
    assert.equal(collabStart.taskId, start.taskId)

    const collabStop = await fetch(`${base}/api/timer/stop`, {
      method: 'POST',
      headers: collabHeaders,
      body: JSON.stringify({ activeSessionId: collabStart.activeSessionId, durationSeconds: 120 }),
    }).then((r) => r.json())
    assert.equal(collabStop.entry.userId, members.members[0].id)

    const stop = await fetch(`${base}/api/timer/stop`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ activeSessionId: start.activeSessionId, durationSeconds: 180, contextSwitches: 2 }),
    }).then((r) => r.json())
    assert.equal(stop.entry.dur, 3)

    const feedback = await fetch(`${base}/api/entries/${stop.entry.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ feedback: { flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High', note: 'test' }, blockers: ['unclear'] }),
    }).then((r) => r.json())
    assert.equal(feedback.entry.feedback.flowQuality, 'Great flow')
    assert.equal(feedback.entry.isEdited, true)

    const manual = await fetch(`${base}/api/manual-entry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Manual integration', categoryId: 'admin', date: '2026-06-10', start: 720, dur: 30 }),
    }).then((r) => r.json())
    assert.equal(manual.entry.isManual, true)

    const exported = await fetch(`${base}/api/export?format=json`, { headers: { authorization: `Bearer ${token}` } })
    assert.equal(exported.status, 200)
    const rows = await exported.json()
    assert.ok(rows.some((row) => row.task === 'Manual integration'))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
