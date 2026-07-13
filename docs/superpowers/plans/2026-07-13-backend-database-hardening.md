# Backend And Database Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every core Nuxt time-tracking workflow persist safely through authenticated Nitro APIs into PostgreSQL, with verified permissions, durable timer activity, auditability, and an isolated legacy application.

**Architecture:** Keep `frontend/app.vue` as the current coordinator while moving HTTP validation and persistence rules into focused backend utilities. PostgreSQL remains authoritative for sessions, active timers, pauses, context-switch counts, entries, and derived refresh state; every schema change is delivered as a new Prisma migration. Integration tests use a guarded disposable PostgreSQL database and each task completes its own red-green-verification cycle.

**Tech Stack:** Nuxt 3, Vue 3, TypeScript, Nitro/H3, Prisma 6, PostgreSQL 16, Vitest, Happy DOM, Docker Compose.

## Global Constraints

- Do not add billable hours, hourly rates, earnings, salary rates, or client billing logic.
- Do not expose individual performance rankings or raw individual data in company dashboards.
- Store context-switch counts only; never store destination URLs, app names, website names, screenshots, window titles, keystrokes, or screen contents.
- API routes enforce authenticated access and task membership/ownership on the server.
- Every Prisma schema change gets a new migration; never edit `0001_init` or `0002_runtime_persistence_gap`.
- Preserve the user's existing `package-lock.json` modification unless a dependency installation intentionally changes it and the diff is reviewed.
- Do not begin the next task until the current task's verification commands pass or the blocker is reported.

## File Structure

- `tests/integration/helpers/database.ts`: guard, reset, migrate, and seed helpers for the disposable PostgreSQL database.
- `tests/integration/*.test.ts`: PostgreSQL-backed persistence and permission tests grouped by workflow.
- `backend/utils/validation.ts`: runtime request parsers and bounded value validation.
- `backend/utils/auth.ts`: authenticated session identity and current-session revocation.
- `backend/utils/store.ts`: existing persistence service; gains permission-safe loading and entry operations.
- `backend/utils/timer-activity.ts`: focused pause/resume and context-switch persistence operations extracted from the large store service.
- `backend/utils/derived-refresh.ts`: idempotent Breezy/medal refresh queue and processor.
- `backend/api/entries/[id].patch.ts`: owned completed-entry edit endpoint.
- `backend/api/timer-pause.post.ts`, `timer-resume.post.ts`, `timer-context-switch.post.ts`: durable timer activity routes.
- `backend/prisma/migrations/0003_*` onward: append-only schema migrations.
- `frontend/components/EntryEditModal.vue`: focused entry editing UI.
- `frontend/app.vue`: API orchestration and timer activity event wiring.

---

### Task 0: Disposable PostgreSQL Integration Harness

**Files:**
- Create: `tests/integration/helpers/database.ts`
- Create: `tests/integration/database-smoke.test.ts`
- Modify: `package.json`
- Modify: `docker-compose.dev.yml`
- Modify: `vitest.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `assertTestDatabase(url: string): void`, `resetTestDatabase(): Promise<void>`, `disconnectTestDatabase(): Promise<void>`, `createUser(input)`, `createTaskFixture(input)`, and `createEntryFixture(input)`.
- Consumes: `DATABASE_URL`, Prisma client, checked-in migrations.

- [ ] **Step 1: Add the failing database guard and smoke tests**

```ts
import { describe, expect, it } from 'vitest'
import { assertTestDatabase } from './helpers/database'

describe('PostgreSQL integration harness', () => {
  it('rejects a database URL not explicitly named as a test database', () => {
    expect(() => assertTestDatabase('postgresql://postgres:postgres@localhost/ag_time_tracker')).toThrow(/test database/i)
  })

  it('accepts the disposable integration database', () => {
    expect(() => assertTestDatabase('postgresql://postgres:postgres@localhost/ag_time_tracker_test')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run RED**

Run: `docker compose -f docker-compose.dev.yml run --rm test npm run test:integration -- tests/integration/database-smoke.test.ts`

Expected: FAIL because `tests/integration/helpers/database.ts` and `test:integration` do not exist.

- [ ] **Step 3: Implement the guarded helper and test command**

```ts
import { PrismaClient } from '@prisma/client'

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''
export const integrationPrisma = new PrismaClient({ datasources: { db: { url } } })

export function assertTestDatabase(databaseUrl: string) {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '')
  if (!databaseName.endsWith('_test')) throw new Error('Integration tests require a database name ending in _test.')
}

export async function resetTestDatabase() {
  assertTestDatabase(url)
  await integrationPrisma.$transaction([
    integrationPrisma.entryAuditEvent.deleteMany(),
    integrationPrisma.entryBlocker.deleteMany(),
    integrationPrisma.entryFeedback.deleteMany(),
    integrationPrisma.entryPause.deleteMany(),
    integrationPrisma.trackingPresence.deleteMany(),
    integrationPrisma.timeEntry.deleteMany(),
    integrationPrisma.taskInvite.deleteMany(),
    integrationPrisma.taskMember.deleteMany(),
    integrationPrisma.task.deleteMany(),
    integrationPrisma.authSession.deleteMany(),
    integrationPrisma.settings.deleteMany(),
    integrationPrisma.category.deleteMany(),
    integrationPrisma.user.deleteMany()
  ])
}

export async function disconnectTestDatabase() {
  await integrationPrisma.$disconnect()
}

export async function createUser(input: { id: string, email: string, displayName: string, team?: string }) {
  return integrationPrisma.user.create({
    data: { ...input, team: input.team || 'Software', passwordHash: 'integration-test-only' }
  })
}

export async function createTaskFixture(input: { id: string, ownerId: string, title?: string, memberIds?: string[] }) {
  const category = await integrationPrisma.category.upsert({
    where: { id: 'test-category' },
    update: {},
    create: { id: 'test-category', name: 'Test category' }
  })
  return integrationPrisma.task.create({
    data: {
      id: input.id,
      title: input.title || 'Integration task',
      description: '',
      categoryId: category.id,
      ownerId: input.ownerId,
      isShared: Boolean(input.memberIds?.length),
      members: {
        create: [
          { userId: input.ownerId, role: 'owner', invitedByUserId: input.ownerId },
          ...(input.memberIds || []).map((userId) => ({ userId, role: 'member', invitedByUserId: input.ownerId }))
        ]
      }
    }
  })
}

export async function createEntryFixture(input: { id: string, userId: string, taskId: string, active?: boolean, contextSwitches?: number }) {
  const startedAt = new Date('2026-07-13T09:00:00.000Z')
  return integrationPrisma.timeEntry.create({
    data: {
      id: input.id,
      userId: input.userId,
      taskId: input.taskId,
      startedAt,
      endedAt: input.active ? null : new Date('2026-07-13T10:00:00.000Z'),
      durationSeconds: input.active ? 0 : 3600,
      contextSwitches: input.contextSwitches || 0
    }
  })
}
```

Add `test:integration` to `package.json` and configure the Compose test service with `ag_time_tracker_test`. Apply migrations before Vitest and refuse a non-`_test` URL.

- [ ] **Step 4: Run GREEN and regression verification**

Run:

```bash
docker compose -f docker-compose.dev.yml run --rm test npm run test:integration -- tests/integration/database-smoke.test.ts
docker compose -f docker-compose.dev.yml run --rm test npm test
```

Expected: smoke test and existing unit suite PASS; migration deploy exits 0.

- [ ] **Step 5: Commit only Task 0 files**

```bash
git add tests/integration package.json docker-compose.dev.yml vitest.config.ts .env.example
git commit -m "test: add guarded postgres integration harness"
```

### Task 1: Pending Invitation And Shared-Entry Permissions

**Files:**
- Create: `tests/integration/task-permissions.test.ts`
- Modify: `backend/utils/store.ts`
- Modify: `backend/api/invitations.post.ts`

**Interfaces:**
- Produces: `loadAccessibleTasks(userId)`, `loadInvitationTaskSummaries(userId)`, and permission-safe `publicState` behavior.
- Consumes: integration database helpers from Task 0.

- [ ] **Step 1: Write failing permission tests**

Create owner, accepted member, pending invitee, and unrelated user with the Task 0 helpers, then create one shared task, one owner entry, and one pending `taskInvite`. Use these exact assertions:

```ts
expect(pendingState.taskInvitations).toContainEqual(expect.objectContaining({ status: 'pending' }))
expect(pendingState.entries).not.toContainEqual(expect.objectContaining({ taskId: sharedTask.id }))
expect(memberState.entries).toContainEqual(expect.objectContaining({ taskId: sharedTask.id }))
expect(unrelatedState.tasks).not.toContainEqual(expect.objectContaining({ id: sharedTask.id }))
await expect(shareTask({ taskId: sharedTask.id, senderId: member.id, recipientIds: [unrelated.id] })).rejects.toMatchObject({ statusCode: 403 })
await integrationPrisma.taskInvite.update({ where: { id: invitation.id }, data: { status: 'accepted' } })
await expect(acceptTaskInvitation({ invitationId: invitation.id, userId: pending.id })).rejects.toMatchObject({ statusCode: 404 })
```

- [ ] **Step 2: Run RED**

Run: `npm run test:integration -- tests/integration/task-permissions.test.ts`

Expected: FAIL because pending invitee receives shared task entries and accepted-state validation is absent.

- [ ] **Step 3: Separate membership access from invitation summaries**

Change the entry-access task query to only owner/member conditions:

```ts
const accessWhere = {
  isArchived: false,
  OR: [{ ownerId: userId }, { members: { some: { userId } } }]
}
```

Load pending invitation task summaries separately and merge only task metadata needed by the invitation UI. Require `status: 'pending'` inside `acceptTaskInvitation`.

- [ ] **Step 4: Run GREEN and full gates**

Run:

```bash
npm run test:integration -- tests/integration/task-permissions.test.ts
npm test
npm run lint
```

Expected: all commands exit 0 and pending bootstrap contains no unauthorized entry.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/task-permissions.test.ts backend/utils/store.ts backend/api/invitations.post.ts
git commit -m "fix: enforce accepted task membership for entry reads"
```

### Task 2: Runtime Validation And Current-Session Logout

**Files:**
- Create: `backend/utils/validation.ts`
- Create: `tests/unit/validation.test.ts`
- Create: `tests/integration/session-security.test.ts`
- Modify: `backend/utils/auth.ts`
- Modify: `backend/api/session.delete.ts`
- Modify: all mutating files under `backend/api/`
- Modify: `backend/utils/store.ts`
- Modify: `frontend/app.vue`

**Interfaces:**
- Produces: `requiredString`, `boundedInteger`, `enumValue`, `isoDate`, `pauseWindows`, `requireAuthenticatedSession`, `revokeSession(sessionId)`.
- Consumes: route request bodies and authenticated tokens.

- [ ] **Step 1: Write failing validation and two-session logout tests**

```ts
expect(() => boundedInteger('contextSwitches', -1, { min: 0, max: 100000 })).toThrow(/contextSwitches/)
expect(() => requiredString('title', ' '.repeat(3), { max: 200 })).toThrow(/title/)
expect(() => pauseWindows([{ startedAt: end, endedAt: start }], start, end)).toThrow(/pause/)
```

Create two persisted auth sessions for one user, invoke logout with session A, and assert A is revoked while B remains active.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/unit/validation.test.ts tests/integration/session-security.test.ts`

Expected: FAIL because the validation module and current-session revocation do not exist.

- [ ] **Step 3: Implement parsers and session identity**

Return `{ user, sessionId, token }` from a new authenticated-session helper. Replace `revokeUserSessions(user.id)` in logout with `revokeSession(sessionId)`. Reject the default/missing secret when `NODE_ENV === 'production'`. Parse route bodies before calling store services and never spread untrusted bodies together with trusted identity fields.

- [ ] **Step 4: Minimize bootstrap user fields**

Change collaboration lists to `{ id, displayName, team }`; keep the current user's email only in `state.user`. Update the frontend interface and share UI accordingly.

- [ ] **Step 5: Run GREEN and gates**

Run:

```bash
npm test -- tests/unit/validation.test.ts tests/integration/session-security.test.ts
npm test
npm run lint
npm run build
```

Expected: validation, session, unit, typecheck, and build commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend frontend/app.vue tests
git commit -m "fix: validate api input and revoke current session"
```

### Task 3: Database-Enforced Single Active Timer

**Files:**
- Create: `backend/prisma/migrations/0003_one_active_entry_per_user/migration.sql`
- Create: `tests/integration/timer-concurrency.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/utils/store.ts`

**Interfaces:**
- Produces: PostgreSQL partial unique index `uq_time_entries_one_active_per_user` and HTTP 409 mapping.

- [ ] **Step 1: Write a failing concurrent-start test**

Issue two `startEntry` calls with `Promise.allSettled`, then assert one fulfillment, one 409 rejection, and one active database row.

- [ ] **Step 2: Run RED**

Run: `npm run test:integration -- tests/integration/timer-concurrency.test.ts`

Expected: FAIL because concurrent requests can create two active rows.

- [ ] **Step 3: Add the append-only migration**

```sql
DO $$
BEGIN
  IF EXISTS (
    SELECT user_id FROM time_entries WHERE ended_at IS NULL GROUP BY user_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one active entry: duplicate active rows exist';
  END IF;
END $$;

CREATE UNIQUE INDEX uq_time_entries_one_active_per_user
ON time_entries(user_id)
WHERE ended_at IS NULL;
```

Document the database-managed partial index in `schema.prisma` and translate Prisma unique errors from the create transaction to HTTP 409.

- [ ] **Step 4: Run GREEN and migration gates**

Run:

```bash
npx prisma validate --schema backend/prisma/schema.prisma
npx prisma migrate deploy --schema backend/prisma/schema.prisma
npm run test:integration -- tests/integration/timer-concurrency.test.ts
npm test
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/utils/store.ts tests/integration/timer-concurrency.test.ts
git commit -m "fix: enforce one active timer per user"
```

### Task 4: Owned Completed-Entry Editing And Audit

**Files:**
- Create: `backend/api/entries/[id].patch.ts`
- Create: `frontend/components/EntryEditModal.vue`
- Create: `tests/integration/entry-edit.test.ts`
- Create: `tests/unit/entry-edit.test.ts`
- Modify: `backend/utils/store.ts`
- Modify: `frontend/app.vue`
- Modify: `docs/specs/features/03-timer-tracking-entries.spec.md`

**Interfaces:**
- Produces: `updateEntry(userId, entryId, input): Promise<MappedEntry>` and `PATCH /api/entries/:id`.

- [ ] **Step 1: Write failing ownership, overlap, audit, and export tests**

Assert successful owner edit, 404 for another user's entry, 403 for inaccessible target task, 409 for overlap, `isEdited === true`, an `entry_audit_events` row, and `edited: true` in export.

- [ ] **Step 2: Run RED**

Run: `npm run test:integration -- tests/integration/entry-edit.test.ts`

Expected: 404 because the route does not exist.

- [ ] **Step 3: Implement one transactional edit service**

Load `{ id: entryId, userId, endedAt: { not: null } }`, validate task access and overlap excluding the same entry, calculate duration, and use a Prisma transaction to replace pauses/feedback/blockers, update the entry with `isEdited: true`, and create an audit event containing `before` and `after` JSON.

- [ ] **Step 4: Add the focused edit modal**

The modal receives one owned completed entry and accessible tasks, emits a validated patch, displays server errors, and shows manual/edited badges. Keep API calls in the app coordinator.

- [ ] **Step 5: Run GREEN and browser/build gates**

Run:

```bash
npm run test:integration -- tests/integration/entry-edit.test.ts
npm test
npm run lint
npm run build
```

Then verify owner editing, denial for foreign entry through direct API, history refresh, dashboards, Journey, medals, and CSV/JSON export in the browser.

- [ ] **Step 6: Commit**

```bash
git add backend frontend tests docs/specs/features/03-timer-tracking-entries.spec.md
git commit -m "feat: add audited time entry editing"
```

### Task 5: Durable Pause And Resume

**Files:**
- Create: `backend/prisma/migrations/0004_active_entry_pauses/migration.sql`
- Create: `backend/utils/timer-activity.ts`
- Create: `backend/api/timer-pause.post.ts`
- Create: `backend/api/timer-resume.post.ts`
- Create: `tests/integration/timer-pause.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/api/timer-stop.post.ts`
- Modify: `backend/utils/store.ts`
- Modify: `shared/utils/time.ts`
- Modify: `frontend/app.vue`

**Interfaces:**
- Produces: `pauseActiveEntry(userId, entryId)`, `resumeActiveEntry(userId, entryId)`, nullable active `EntryPause.endedAt` and `durationSeconds`.

- [ ] **Step 1: Write failing pause lifecycle tests**

Use an active owner entry and assert the exact lifecycle:

```ts
await pauseActiveEntry(owner.id, entry.id)
await expect(pauseActiveEntry(owner.id, entry.id)).rejects.toMatchObject({ statusCode: 409 })
expect((await publicState(owner.id)).entries.find((row) => row.id === entry.id)?.pauses).toContainEqual(expect.objectContaining({ endedAt: null }))
await expect(resumeActiveEntry(other.id, entry.id)).rejects.toMatchObject({ statusCode: 404 })
await resumeActiveEntry(owner.id, entry.id)
await expect(resumeActiveEntry(owner.id, entry.id)).rejects.toMatchObject({ statusCode: 409 })
```

Add a second case that pauses and then stops the entry; assert no open pause remains and `durationSeconds` excludes the persisted pause.

- [ ] **Step 2: Run RED**

Run: `npm run test:integration -- tests/integration/timer-pause.test.ts`

Expected: FAIL because pause routes do not exist.

- [ ] **Step 3: Add migration and Prisma changes**

Make `ended_at` and `duration_seconds` nullable and add a partial unique index permitting one open pause per entry:

```sql
ALTER TABLE entry_pauses ALTER COLUMN ended_at DROP NOT NULL;
ALTER TABLE entry_pauses ALTER COLUMN duration_seconds DROP NOT NULL;
CREATE UNIQUE INDEX uq_entry_pauses_one_open_per_entry ON entry_pauses(entry_id) WHERE ended_at IS NULL;
```

- [ ] **Step 4: Implement server-clock pause/resume and stop integration**

Pause creates an open row; resume updates it with server `endedAt` and duration; stop closes an open pause at the same stop timestamp. Remove arbitrary client pause history from the normal stop contract.

- [ ] **Step 5: Wire frontend to persisted pause state**

Replace local-only pause/resume mutations with authenticated API calls. Derive `pausedAt` from the active entry's open pause after bootstrap.

- [ ] **Step 6: Run GREEN and gates**

Run Prisma validation/migrate, focused integration test, full test, typecheck, and build. Browser-check pause → refresh → resume → stop and compare stored pause duration.

- [ ] **Step 7: Commit**

```bash
git add backend frontend/app.vue shared tests
git commit -m "feat: persist active timer pauses"
```

### Task 6: Durable Privacy-Preserving Context Switch Counts

**Files:**
- Create: `backend/api/timer-context-switch.post.ts`
- Create: `tests/unit/context-switch.test.ts`
- Create: `tests/integration/context-switch.test.ts`
- Modify: `backend/utils/timer-activity.ts`
- Modify: `backend/api/timer-stop.post.ts`
- Modify: `backend/utils/store.ts`
- Modify: `shared/utils/time.ts`
- Modify: `frontend/app.vue`
- Modify: `docs/specs/features/05-idle-context-settings.spec.md`

**Interfaces:**
- Produces: `shouldRecordContextSwitch(input): boolean`, `recordContextSwitch(userId, entryId): Promise<number>`, and `POST /api/timer-context-switch` returning `{ entryId, contextSwitches }`.

- [ ] **Step 1: Write failing transition-guard tests**

```ts
expect(shouldRecordContextSwitch({ previous: 'visible', current: 'hidden', active: true, paused: false, enabled: true })).toBe(true)
expect(shouldRecordContextSwitch({ previous: 'hidden', current: 'hidden', active: true, paused: false, enabled: true })).toBe(false)
expect(shouldRecordContextSwitch({ previous: 'visible', current: 'hidden', active: true, paused: true, enabled: true })).toBe(false)
expect(shouldRecordContextSwitch({ previous: 'visible', current: 'hidden', active: true, paused: false, enabled: false })).toBe(false)
```

- [ ] **Step 2: Write failing PostgreSQL API tests and run RED**

Use these behavioral assertions for atomic increment, concurrency, access, settings, restoration, and stop integrity:

```ts
expect(await recordContextSwitch(owner.id, active.id)).toBe(1)
await Promise.all([recordContextSwitch(owner.id, active.id), recordContextSwitch(owner.id, active.id)])
expect((await integrationPrisma.timeEntry.findUniqueOrThrow({ where: { id: active.id } })).contextSwitches).toBe(3)
await expect(recordContextSwitch(other.id, active.id)).rejects.toMatchObject({ statusCode: 404 })
await expect(recordContextSwitch(owner.id, completed.id)).rejects.toMatchObject({ statusCode: 409 })
await integrationPrisma.settings.upsert({ where: { userId: owner.id }, update: { activityEnabled: false }, create: { userId: owner.id, activityEnabled: false, locationLabels: [] } })
expect(await recordContextSwitch(owner.id, active.id)).toBe(3)
expect((await publicState(owner.id)).entries.find((row) => row.id === active.id)?.contextSwitches).toBe(3)
```

Stop the entry using a request body containing a forged `contextSwitches: 0`; assert the parser discards that field and the database retains `3`.

Run: `npm test -- tests/unit/context-switch.test.ts tests/integration/context-switch.test.ts`

Expected: FAIL because the guard and endpoint do not exist.

- [ ] **Step 3: Implement atomic server persistence**

Verify active owned entry and settings, then:

```ts
const updated = await prisma.timeEntry.update({
  where: { id: entryId },
  data: { contextSwitches: { increment: 1 } },
  select: { contextSwitches: true }
})
```

Remove `contextSwitches` from the trusted stop input and preserve the database value.

- [ ] **Step 4: Serialize frontend visibility requests**

Track previous visibility state, evaluate the guard, queue one request at a time for the current entry ID, use the server-returned count, and stop retrying if the active entry changes. Restore the displayed count from bootstrap.

- [ ] **Step 5: Run GREEN, privacy scan, and browser gate**

Run:

```bash
npm test -- tests/unit/context-switch.test.ts tests/integration/context-switch.test.ts
rg -n "destinationUrl|websiteName|appName|windowTitle|screenshot|keystroke" backend frontend shared
npm test
npm run lint
npm run build
```

Expected: tests/typecheck/build exit 0; privacy scan finds no introduced storage fields. Browser-check start → switch tab → return → refresh → stop and inspect `time_entries.context_switches`.

- [ ] **Step 6: Commit**

```bash
git add backend frontend/app.vue shared tests docs/specs/features/05-idle-context-settings.spec.md
git commit -m "feat: persist context switch counts"
```

### Task 7: Retryable Derived Breezy And Medal Refresh

**Files:**
- Create: `backend/prisma/migrations/0005_derived_refresh_jobs/migration.sql`
- Create: `backend/utils/derived-refresh.ts`
- Create: `tests/integration/derived-refresh.test.ts`
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/utils/store.ts`
- Modify: `backend/api/bootstrap.get.ts`

**Interfaces:**
- Produces: `enqueueDerivedRefresh(tx, userId)`, `processDerivedRefresh(userId)`, `retryPendingDerivedRefresh(userId)`.

- [ ] **Step 1: Write failing queue/idempotency tests**

Assert entry mutation and pending marker commit together; successful processing marks completion; forced failure retains `lastError` and increments attempts; bootstrap retry repairs it; running twice produces identical Breezy days and medals.

- [ ] **Step 2: Run RED**

Run: `npm run test:integration -- tests/integration/derived-refresh.test.ts`

Expected: FAIL because `DerivedRefreshJob` does not exist.

- [ ] **Step 3: Add migration and processor**

Add a user-keyed table with `requested_at`, `attempt_count`, `last_error`, and `completed_at`. Upsert the marker in the entry transaction, process synchronously afterward, and retry incomplete work during bootstrap. Keep processing idempotent.

- [ ] **Step 4: Run GREEN and gates**

Run Prisma validation/migrate, focused integration test, complete tests, typecheck, and build.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/utils backend/api/bootstrap.get.ts tests/integration/derived-refresh.test.ts
git commit -m "feat: make derived record refresh retryable"
```

### Task 8: Optional Persistence Decisions And Documentation

**Files:**
- Modify: `docs/specs/features/05-idle-context-settings.spec.md`
- Modify: `docs/specs/features/08-breezy-companion.spec.md`
- Modify: `docs/specs/features/13-data-persistence-audit.spec.md`
- Modify: `docs/milestones.md`

**Interfaces:**
- Produces: explicit deferral for Breezy nudge history unless acknowledgement UI exists; device-local theme decision.

- [ ] **Step 1: Add a failing documentation assertion**

Extend `tests/unit/deployment-config.test.ts` or create `tests/unit/persistence-docs.test.ts` asserting the docs explicitly state that theme is device-local and Breezy nudge persistence is deferred until acknowledgement exists.

- [ ] **Step 2: Run RED, update docs, run GREEN**

Run: `npm test -- tests/unit/persistence-docs.test.ts`; update the four documents; rerun focused and complete tests.

- [ ] **Step 3: Commit**

```bash
git add docs tests/unit/persistence-docs.test.ts
git commit -m "docs: record optional persistence decisions"
```

### Task 9: Legacy Application Isolation

**Files:**
- Modify: `aq-time-tracker-software/README.md`
- Modify: `.dockerignore`
- Modify: `tests/unit/deployment-config.test.ts`
- Inspect only unless a reference is found: `Dockerfile`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `deploy.sh`, root `package.json`.

**Interfaces:**
- Produces: explicit legacy notice and Docker exclusion; production commands remain rooted in Nuxt/PostgreSQL.

- [ ] **Step 1: Write failing deployment assertions**

```ts
expect(dockerignore).toContain('aq-time-tracker-software')
expect(legacyReadme).toMatch(/legacy/i)
expect(legacyReadme).toMatch(/not.*production/i)
```

Also assert root production configuration does not reference `node:sqlite`, `backend/api.js`, `standalone-main`, or the legacy package path.

- [ ] **Step 2: Run RED**

Run: `npm test -- tests/unit/deployment-config.test.ts`

Expected: FAIL because the legacy directory is not excluded or labelled clearly.

- [ ] **Step 3: Add legacy notice and Docker exclusion**

Add `aq-time-tracker-software` to `.dockerignore`. Add a prominent README notice identifying React/Vite, SQLite, and local-storage standalone behavior and directing production work to the root Nuxt/PostgreSQL application. Do not edit legacy runtime files.

- [ ] **Step 4: Run GREEN and production gates**

Run:

```bash
npm test -- tests/unit/deployment-config.test.ts
npm test
npm run lint
docker build --target build -t ag-time-tracker-build-check .
```

Expected: tests/typecheck/Docker build exit 0 and build context excludes the legacy directory.

- [ ] **Step 5: Commit**

```bash
git add aq-time-tracker-software/README.md .dockerignore tests/unit/deployment-config.test.ts
git commit -m "chore: isolate legacy tracker from production"
```

### Task 10: Clean-Database End-To-End Verification And Evidence

**Files:**
- Modify: `docs/milestones.md`
- Modify: affected files under `docs/specs/features/`
- No production code changes unless a new failing test first demonstrates a defect.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: fresh reproducible verification evidence and an accurate milestone state.

- [ ] **Step 1: Apply all migrations to a new empty PostgreSQL test database**

Run: `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ag_time_tracker_test npx prisma migrate reset --force --skip-seed --schema backend/prisma/schema.prisma`

Expected: migrations `0001` through `0005` apply successfully.

- [ ] **Step 2: Run automated gates**

```bash
npm test
npm run lint
npm run build
npx prisma validate --schema backend/prisma/schema.prisma
npx prisma migrate status --schema backend/prisma/schema.prisma
```

Expected: every command exits 0 with no failed tests.

- [ ] **Step 3: Seed and run the application**

```bash
npm run db:seed
npm run dev -- --host 127.0.0.1
```

Verify sign in, task create/share/invite/accept, start, pause, refresh, resume, context switch, stop, feedback, manual entry, entry edit, personal dashboard, aggregate company dashboard, Journey, medals, settings, CSV, JSON, current-session logout, and second-session continuity.

- [ ] **Step 4: Inspect persisted rows**

Use Prisma Studio or `psql` to inspect `auth_sessions`, `task_invites`, `task_members`, `time_entries`, `entry_pauses`, `entry_feedback`, `entry_blockers`, `entry_audit_events`, `tracking_presence`, `breezy_days`, `user_medals`, `derived_refresh_jobs`, and `exports` after their workflows.

- [ ] **Step 5: Update evidence without overstating completion**

Record exact commands, exit codes, browser scenarios, database observations, and external limitations in `docs/milestones.md` and relevant specs. Do not mark a milestone complete if any required gate is blocked.

- [ ] **Step 6: Commit verification evidence**

```bash
git add docs/milestones.md docs/specs/features
git commit -m "docs: record backend hardening verification"
```
