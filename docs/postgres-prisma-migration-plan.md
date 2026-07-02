# PostgreSQL Prisma Migration Plan

## Summary

The application is intended to use PostgreSQL through Prisma for production persistence. This plan was implemented on 2026-07-02 by moving runtime API behavior from seeded in-memory state to Prisma-backed services.

This plan describes how to move runtime behavior to PostgreSQL through Prisma while preserving the current frontend API contract as much as possible.

## Current State

- `backend/prisma/schema.prisma` defines the PostgreSQL target schema.
- `backend/prisma/migrations/0001_init/migration.sql` creates the first database schema.
- `backend/prisma/migrations/0002_runtime_persistence_gap/migration.sql` adds runtime persistence gaps such as auth sessions, task invites, tracking presence, edited flags, and audit events.
- `.env.example` includes `DATABASE_URL`.
- `package.json` includes `prisma` and `@prisma/client`.
- `backend/utils/prisma.ts` provides the Prisma client singleton.
- Runtime API routes call Prisma-backed services in `backend/utils/store.ts`.
- Seed/demo data lives in `backend/prisma/seed.mjs`.
- Auth session validation resolves users from persisted `auth_sessions`.

## Goals

- Use PostgreSQL as the source of truth for production runtime behavior.
- Access PostgreSQL through Prisma from Nitro backend routes.
- Preserve the current frontend response shape during the migration.
- Enforce authentication, ownership, and task membership rules on the server.
- Keep personal raw data exportable by the individual user.
- Keep company dashboards aggregated and process-focused.
- Avoid billing, hourly rate, salary, earnings, screenshots, app names, website names, URLs, or private activity details.

## Non-Goals

- Do not add billing or rates.
- Do not add individual performance rankings.
- Do not redesign the UI as part of the database migration.
- Do not rewrite unrelated frontend components unless required by changed API contracts.
- Do not edit existing shared migrations after they have been committed.

## Phase 1: Audit Current Runtime Behavior

Inventory the in-memory data model and the API contract before changing persistence.

- Map every collection in `backend/utils/store.ts` to a Prisma model or planned model.
- Capture the shape returned by `publicState()`.
- List every API route that imports `../utils/store`.
- Identify all server-side permission checks currently implemented in `store.ts`.
- Identify behavior that is currently implicit in seed data, such as default settings and default blockers.
- Confirm which calculations can remain pure utilities, such as duration, Breezy day derivation, medals, and CSV formatting.

Primary files:

- `backend/utils/store.ts`
- `backend/utils/auth.ts`
- `backend/api/*.ts`
- `shared/utils/time.ts`
- `docs/specs/features/13-data-persistence-audit.spec.md`

## Phase 2: Complete The Prisma Schema

Update `backend/prisma/schema.prisma` to cover runtime data that currently exists only in memory or is required by the persistence spec.

Likely additions or changes:

- Add `AuthSession` or an equivalent persisted session model.
- Add `TaskInvite` for pending and accepted task invitations.
- Add `TrackingPresence` if active tracking presence should be queryable independently from active `time_entries`.
- Add `role`, `invitedByUserId`, and `joinedAt` to `TaskMember`.
- Add `isEdited` and `updatedAt` to `TimeEntry`.
- Add `EntryAuditEvent` for manual creation and edits.
- Add missing settings fields used at runtime, such as `muted`.
- Review relation cascade behavior.
- Add indexes for common dashboard, export, auth, task membership, and invitation queries.

Migration discipline:

- Create a new migration for schema changes.
- Do not edit `backend/prisma/migrations/0001_init/migration.sql`.
- Run `prisma validate` after schema changes.
- Run migration apply against a clean PostgreSQL database before marking persistence work complete.

Primary files:

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/*`
- `.env.example`

## Phase 3: Add Prisma Runtime Infrastructure

Introduce a single Prisma client utility for backend runtime use.

Recommended structure:

- Add `backend/utils/prisma.ts`.
- Use a global singleton pattern so Nuxt dev hot reload does not create excessive connections.
- Keep Prisma access inside backend utilities or services rather than scattering complex queries through routes.

Suggested service boundaries:

- Auth and user service.
- Task, member, and invite service.
- Timer and time entry service.
- Settings service.
- Dashboard service.
- Export service.
- Breezy Journey and medal service.

Primary files:

- `backend/utils/prisma.ts`
- new or existing backend service files under `backend/utils/`

## Phase 4: Create Database Seed Data

Move demo data out of in-memory runtime state and into a Prisma seed script.

Seed data should include:

- Demo users.
- Password hashes, never plaintext passwords.
- Categories.
- Clients and projects.
- Tasks and task members.
- Task invitations.
- Time entries across recent days and weeks.
- Entry pauses.
- Feedback and blockers.
- User settings.
- Breezy days or enough entries to derive them.
- Medals or enough entries to award them.
- Export records only if they are useful for demo or audit verification.

Password handling:

- Replace the current plain SHA-256 sign-in record approach with a stronger password hashing strategy.
- Prefer Node's built-in `crypto.scrypt` or another justified password hashing approach.
- Never log, export, seed, or store plaintext passwords.

Primary files:

- `backend/prisma/seed.ts` or equivalent seed script.
- `package.json`
- `.env.example`
- `backend/utils/auth.ts`

## Phase 5: Migrate API Routes In A Safe Order

Migrate route groups gradually while preserving frontend response shapes.

### 5.1 Auth And Sessions

- Move user lookup and creation to Prisma.
- Persist session records if using database-backed sessions.
- Update `getSessionUser()` to resolve the user from PostgreSQL.
- Update sign-out to revoke or expire persisted sessions.

Files:

- `backend/api/session.post.ts`
- `backend/api/session.delete.ts`
- `backend/utils/auth.ts`

### 5.2 Bootstrap State

- Rebuild `publicState()` behavior from Prisma queries.
- Return the same frontend-facing shape initially.
- Include user, users, signed-in users, invitations, categories, clients, projects, blockers, tasks, entries, settings, dashboards, journey, and medals.

Files:

- `backend/api/bootstrap.get.ts`
- `backend/utils/store.ts` replacement service or services

### 5.3 Tasks, Sharing, And Invitations

- Create tasks in PostgreSQL.
- Store members through `task_members`.
- Store pending invitations through `task_invites`.
- Enforce owner-only sharing on the server.
- Enforce invite recipient-only acceptance on the server.

Files:

- `backend/api/tasks.post.ts`
- `backend/api/tasks-share.post.ts`
- `backend/api/invitations.post.ts`

### 5.4 Timer And Manual Entries

- Start active entries in `time_entries`.
- Stop entries by setting `ended_at`, duration, idle seconds, context switch count, pauses, feedback, and blockers.
- Store feedback in `entry_feedback`.
- Store blockers through `entry_blockers`.
- Store manual entries with `is_manual = true`.
- Enforce task ownership or membership before tracking.
- Prevent multiple active timers per user.

Files:

- `backend/api/timer-start.post.ts`
- `backend/api/timer-stop.post.ts`
- `backend/api/manual-entry.post.ts`

### 5.5 Settings

- Persist settings per user.
- Preserve current defaults for users without saved settings.
- Ensure location labels remain user-owned.

Files:

- `backend/api/settings.patch.ts`

### 5.6 Dashboards, Insights, And Exports

- Build personal dashboard data from persisted entries scoped to the signed-in user.
- Build company dashboard data from aggregate queries without ranking people.
- Export only the signed-in user's raw data.
- Keep context switches as counts only.
- Keep AI insights fallback behavior, but source dashboard inputs from persisted data.

Files:

- `backend/api/export.get.ts`
- `backend/api/insights.post.ts`
- dashboard/export service files

### 5.7 Breezy Journey And Medals

- Decide whether Breezy days are persisted in `breezy_days` or derived on demand from `time_entries`.
- If persisted, define when rollups are updated.
- Keep medals process-oriented and personal, not company ranking data.

Files:

- Breezy Journey service files.
- medal service files.
- `shared/utils/time.ts`

## Phase 6: Retire In-Memory Runtime Persistence

Once all routes use Prisma:

- Remove runtime dependency on `backend/utils/store.ts`.
- Keep pure calculations in `shared/utils/time.ts`.
- Move any remaining useful seed constants into the Prisma seed script.
- Remove or rewrite tests that import `store`.
- Update docs that describe the in-memory implementation gap.

Primary files:

- `backend/utils/store.ts`
- `tests/unit/*.test.ts`
- `docs/milestones.md`
- `docs/specs/features/13-data-persistence-audit.spec.md`

## Phase 7: Verification

Run the fastest useful checks after each small migration slice, then broaden verification once runtime behavior has moved to Prisma.

Recommended checks:

- `npx.cmd prisma validate`
- Apply migrations against a clean PostgreSQL database.
- Run the Prisma seed script.
- `npm.cmd run test`
- `npm.cmd run build`
- API integration tests against a test PostgreSQL database.
- Browser workflow verification for sign in, create task, share task, accept invite, start timer, stop timer, save feedback, create manual entry, dashboard update, Breezy Journey, CSV export, and JSON export.

Important test coverage:

- User can only export their own raw data.
- User can track only owned tasks or accepted shared tasks.
- Only task owner can share a task.
- Only invitation recipient can accept an invitation.
- Feedback and blockers persist as discrete fields.
- Company dashboard remains aggregated and does not rank individuals.
- Context-switch tracking stores counts only.

## Suggested Implementation Order

1. Schema gap update and migration.
2. Prisma client utility.
3. Seed script.
4. Auth and session persistence.
5. Bootstrap read model.
6. Tasks, sharing, and invitations.
7. Timer, feedback, blockers, and manual entries.
8. Settings.
9. Dashboards, exports, insights, Breezy Journey, and medals.
10. Remove runtime store dependency.
11. Update docs and milestones with final verification evidence.

## Completion Criteria

- Runtime API routes no longer use seeded in-memory state for production behavior.
- PostgreSQL is the source of truth for auth, tasks, entries, feedback, blockers, dashboards, settings, Breezy Journey inputs, medals, and exports.
- Prisma schema and migrations are aligned.
- Seed data creates a usable local demo.
- Permission boundaries are covered by tests.
- Migration and build checks pass.
- Documentation no longer lists PostgreSQL runtime persistence as an open implementation gap.
