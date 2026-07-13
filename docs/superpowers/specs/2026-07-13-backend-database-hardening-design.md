# Backend And Database Hardening Design

## Purpose

Strengthen the production Nuxt/Nitro and PostgreSQL path in small, independently verifiable changes. Each change must preserve personal data ownership, aggregated company reporting, server-side authorization, and migration-backed Prisma schema evolution.

The React/SQLite application under `aq-time-tracker-software/` remains available as historical reference, but it must be clearly marked legacy and excluded from production build, test, Docker, CI, and deployment inputs.

## Decisions

- The production application remains the root Nuxt 3 application using Nitro API routes and PostgreSQL through Prisma.
- Work proceeds as small risk-ordered change sets. A change set cannot begin until the previous set has passed its defined verification gate.
- Company dashboards remain available to every authenticated AirGradient user and expose aggregate process data only.
- Sign out revokes only the current authenticated session. A future explicit action may revoke all sessions.
- Entry editing is in scope. Entry deletion is not introduced because deletion semantics are not defined by the current feature spec.
- Pause and resume state must eventually survive refreshes and browser restarts by being persisted through server APIs.
- Every Prisma schema change receives a new migration. Existing migrations are never edited.
- No billing, rate, salary, earnings, destination URL, application name, website name, screenshot, or private activity data is added.

## Delivery Method

Each change set follows the same gate:

1. Read the relevant feature spec and inspect the exact production path.
2. Add a focused test that fails for the missing or incorrect behavior.
3. Run the focused test and confirm the expected failure.
4. Implement the smallest production change that satisfies the test.
5. Run the focused test, then the complete unit/integration test suite.
6. Run Prisma validation for schema-affecting work and typecheck for shared or API contract changes.
7. Run build or browser verification when the change affects runtime routing or user workflows.
8. Record evidence and limitations before moving to the next change set.

If dependencies, PostgreSQL, or Docker are unavailable, the change set stops at the verification gate. It is not reported complete based on static inspection alone.

## Change Set 0: Establish A Verifiable PostgreSQL Test Harness

### Goal

Make API and persistence behavior reproducible against a disposable PostgreSQL database without relying on development data.

### Design

- Add a dedicated test database configuration using an explicit test `DATABASE_URL`.
- Apply checked-in migrations before integration tests.
- Reset only the test schema/database between test groups.
- Seed the minimum records required by each test instead of relying on the demo seed.
- Exercise Nitro handlers through HTTP when authorization, cookies, headers, or routing matter. Test store functions directly only for isolated domain behavior.
- Add helper functions for creating users, sessions, tasks, memberships, invitations, and time entries.
- Prevent the test command from accepting a non-test database name.

### Verification gate

- A clean test database accepts all migrations.
- A health/API smoke test reads PostgreSQL successfully.
- The harness refuses to reset a database that is not explicitly marked for tests.
- Existing unit tests remain green.

## Change Set 1: Close Task And Invitation Permission Gaps

### Goal

Ensure a pending invitation reveals invitation metadata only and does not grant task-entry access.

### Data flow

- `loadVisibleTasks` returns tasks owned by the user, tasks with accepted membership, and limited task metadata needed to render a pending invitation.
- `loadVisibleEntries` receives only IDs for owned or accepted-member tasks.
- Start, manual-entry, share, and invitation endpoints continue to enforce authorization on the server.
- Invitation acceptance must require the authenticated recipient and a pending invitation.

### Required behavior

- An owner sees their task and its collaborative entries.
- An accepted member sees the shared task and collaborative entries.
- A pending invitee sees the invitation but no entries for that task.
- A non-member sees neither task nor entries.
- A non-owner cannot invite collaborators.
- An invitation cannot be accepted twice or after it leaves pending status.

### Verification gate

- PostgreSQL-backed permission tests cover owner, member, pending invitee, unrelated user, and non-owner sharing.
- Bootstrap output contains no unauthorized entry.
- Typecheck and the full test suite pass.

## Change Set 2: Validate API Input And Harden Session Handling

### Goal

Reject malformed HTTP input consistently, minimize bootstrap disclosure, and revoke only the current session on sign out.

### Components

- Introduce small server validation helpers for required strings, optional IDs, bounded integers, enums, arrays, ISO dates, and pause windows.
- Route-specific parsers define accepted fields and discard or reject unknown security-sensitive fields.
- Session parsing returns both the user and authenticated session ID where session mutation is required.
- Logout updates only that session's `revokedAt` and clears the cookie/token used by the request.
- Production startup or first authenticated request rejects a missing, default, or insufficiently long session secret.
- Bootstrap member choices expose only the minimum fields required for collaboration: user ID, display name, and team. Email is returned only by a dedicated collaboration lookup if the invite-by-email workflow requires it.

### Validation rules

- Durations, idle seconds, context switches, estimates, and settings numbers are finite bounded integers.
- Task titles, descriptions, feedback notes, display names, and labels have explicit maximum lengths.
- Feedback and settings enum values use allowlists.
- Pause windows contain valid dates, end after start, fall inside the entry, and do not overlap.
- Client/project/category IDs must reference records the operation is allowed to use.

### Verification gate

- Tests cover malformed inputs, excessive values, invalid enums, unknown blockers, and forged user IDs.
- A logout test proves one session is revoked while another session for the same user stays valid.
- A production-secret test proves insecure configuration is rejected.
- API tests, unit tests, and typecheck pass.

## Change Set 3: Enforce One Active Timer Per User In PostgreSQL

### Goal

Prevent concurrent start requests from creating multiple active entries for one user.

### Schema change

Create a new migration with a PostgreSQL partial unique index on `time_entries(user_id)` where `ended_at IS NULL`. Document the index in the Prisma schema because Prisma cannot fully express partial indexes.

Before applying the index, the migration must fail clearly if duplicate active rows exist; it must not silently discard user data.

### Runtime behavior

- Keep the friendly preflight active-entry check.
- Catch the database unique-constraint result from racing requests and return HTTP 409.
- Do not retry timer creation after this constraint error.

### Verification gate

- Migration applies to a clean test database.
- A concurrency test issues two start requests and confirms exactly one active entry and one 409 response.
- Prisma validation, migration status, API tests, and typecheck pass.

## Change Set 4: Add Owned Entry Editing With Audit History

### Goal

Allow a user to edit their own completed entry and recalculate all dependent records.

### API and UI

- Add `PATCH /api/entries/:id`.
- Add a focused edit form in entry history for task, start/end, pauses, feedback, blockers, note, idle seconds, context-switch count, and location label.
- Client/project/category changes happen through the selected task; the edit endpoint does not mutate shared task metadata as a side effect.
- No delete endpoint is added.

### Server transaction

1. Load the entry by ID and authenticated user ID.
2. Require a completed entry.
3. Validate the target task is owned by or shared with the user.
4. Validate dates, pauses, and overlap against the user's other entries.
5. Replace pauses, feedback, and blockers within one Prisma transaction.
6. Update the entry, set `isEdited = true`, and create an `entry_audit_events` record containing old and new values for changed fields.
7. Refresh affected derived dates and medal state after the entry transaction using the existing recomputation service. Change Set 6 later hardens this path with a persisted retry marker without changing the edit API contract.

### Verification gate

- Tests cover successful editing, ownership denial, task-membership denial, overlap rejection, pause validation, audit creation, and `isEdited` export output.
- Browser verification edits an entry and confirms history, dashboard, journey, medals, and export results.
- API tests, unit tests, typecheck, and production build pass.

## Change Set 5: Persist Pause And Resume State

### Goal

Make an active pause survive bootstrap, refresh, and another tab using the same authenticated session.

### Schema change

Create a new migration making `entry_pauses.ended_at` and `duration_seconds` nullable while a pause is active. Add a database constraint or transactional check that permits at most one open pause per entry.

### API

- `POST /api/timer-pause` creates an open pause for the authenticated user's active entry.
- `POST /api/timer-resume` closes that user's open pause and calculates its duration on the server.
- `POST /api/timer-stop` closes any open pause at the stop timestamp before calculating duration.
- Bootstrap returns persisted pauses, including whether the active entry is paused.

The server clock is authoritative for pause boundaries. The frontend displays server state and must not submit arbitrary pause history during normal timer stop.

### Verification gate

- Tests cover pause, duplicate pause conflict, resume without pause, refresh/bootstrap while paused, stop while paused, and cross-user denial.
- Browser verification pauses, refreshes, resumes, and confirms excluded duration.
- Migration, Prisma validation, API tests, typecheck, and build pass.

## Change Set 6: Make Breezy And Medal Derivation Consistent

### Goal

Prevent saved entries from leaving stale Breezy days or medals when derived updates fail.

### Design

Use a persisted recomputation marker rather than holding long transactions while reading and rewriting all historical entries:

- Add a small `derived_refresh_jobs` table through a new migration, keyed by user with requested timestamp, attempt count, last error, and completion timestamp.
- Entry stop, manual creation, and editing enqueue/upsert a refresh request in the same transaction as the entry mutation.
- A synchronous best-effort processor runs after the transaction for immediate UI freshness.
- Bootstrap detects an incomplete marker for the current user and retries processing before returning derived data.
- Processing is idempotent: it recomputes affected Breezy days and the user's medal set from persisted entries.
- Failed work remains recorded for a later retry and is not reported as completed.

This avoids a transaction that spans every historical entry while ensuring the database records that derived state needs repair.

### Verification gate

- Tests prove the marker is committed with entry mutations, successful processing clears it, failed processing leaves it retryable, and bootstrap retries it.
- Re-running the processor produces the same Breezy days and medal set.
- API tests, typecheck, migration checks, and build pass.

## Change Set 7: Connect Or Deliberately Defer Optional Persistence

### Breezy nudges

Persist only product-significant nudge delivery and acknowledgement. Add narrow endpoints only if the current UI exposes acknowledgement; otherwise record the deferral in `docs/milestones.md` and do not create unused runtime APIs.

### Theme

Keep theme in `localStorage` as a device preference. It is not personal time-tracking data and does not need cross-device synchronization. Document this decision so it is not mistaken for missing production persistence.

### Verification gate

- Schema models have either a runtime owner or an explicit documented deferral.
- No core user data depends on browser-only persistence.
- Relevant documentation matches implementation.

## Change Set 8: Isolate The Legacy Application From Production

### Goal

Retain historical source without allowing it into the production path.

### Changes

- Add a legacy notice to `aq-time-tracker-software/README.md` stating that it uses React/Vite, SQLite, and a standalone local-storage mock and must not be deployed as the current application.
- Exclude `aq-time-tracker-software/` from the root Docker build context through `.dockerignore` unless a root production asset is proven to depend on it.
- Ensure root scripts, Docker Compose, Dockerfile, deploy scripts, and CI commands reference only root Nuxt files.
- Add a lightweight deployment configuration test asserting the legacy directory is excluded and not referenced by production commands.
- Do not modify the legacy runtime implementation.

### Verification gate

- Root tests and build pass without reading the legacy directory.
- Docker build context excludes the legacy directory.
- Production configuration contains no SQLite or standalone mock entry point.

## Final End-To-End Gate

After all accepted change sets:

1. Apply every migration to a new empty PostgreSQL test database.
2. Run the complete test suite.
3. Run Nuxt typecheck and production build.
4. Seed a clean development database.
5. Verify sign in, task creation, invitation, acceptance, timer start/pause/refresh/resume/stop, feedback, manual entry, entry edit, personal dashboard, aggregate company dashboard, Breezy Journey, medals, settings, CSV export, JSON export, current-session logout, and second-session continuity.
6. Inspect PostgreSQL rows for the affected models after each workflow.
7. Update feature specs and `docs/milestones.md` with exact verification evidence and unresolved external limitations.

No milestone is marked complete when its browser flow, API behavior, database persistence, or permission boundary remains unverified.

## Expected Production Boundary

At completion, all core user data flows through authenticated Nitro API routes into PostgreSQL. Client state is limited to transient form/display state and the device-local theme preference. Shared task details are available only to owners and accepted members, company reporting remains aggregated, and every schema change is reproducible from checked-in migrations.
