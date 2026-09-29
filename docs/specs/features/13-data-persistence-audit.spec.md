# 13 Data, Persistence, And Audit

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

This cross-cutting spec defines the production persistence target. All core workflows should read from and write to PostgreSQL through server APIs, with enough structure to support dashboards, exports, Breezy Journey, collaboration, and auditability.

## Users

- Developers implementing reliable product behavior.
- Users who expect data to survive refreshes and deployments.
- Company stakeholders relying on accurate aggregate reports.

## Scope

- PostgreSQL via Prisma.
- Checked-in migrations.
- Auth/session persistence.
- Foreign keys, unique constraints, cascade rules where appropriate, and useful indexes.
- Seed/demo data across users, task categories, feedback, blockers, sessions, collaborators, Breezy Journey, and exports. Account-level team values remain legacy compatibility data until their column is removed.
- Audit history for manual creation and edits.
- No billable/rate/earnings columns.

## Out Of Scope

- Production backup tooling in the app UI.
- Billing data.
- Raw browser/app activity logs.

## UI Reference

This is a platform/data spec and has no dedicated UI mockup.

## Functional Requirements

- Runtime core workflows use PostgreSQL through backend API routes.
- `time_entries(user_id, started_at)` and `time_entries(task_id)` are indexed.
- Shared-task data model supports membership, invites, presence, and owner/member roles.
- Manual and edited entries are distinguishable.
- Exports include required raw data fields.
- Dashboard metrics are straightforward reads from persisted data.
- Breezy Journey derives from persisted `breezy_days`.
- Context-switch tracking stores counts only.

## Data And API

Target models from the original spec:

- `users`
- `categories`
- `clients`
- `projects`
- `tasks`
- `task_members`
- `time_entries`
- `entry_pauses`
- `entry_feedback`
- `blockers`
- `entry_blockers`
- `settings`
- `breezy_nudges`
- `breezy_days`
- `medals`
- `user_medals`
- `exports`

Additional required models/fields:

- `auth_sessions` or equivalent.
- `task_members.role`, invited-by user, joined timestamp.
- `task_invites`.
- `tracking_presence`.
- `time_entries.is_edited`.
- `time_entries.updated_at`.
- `entry_audit_events`.

## Current Implementation

- `backend/prisma/schema.prisma` defines the base PostgreSQL target schema.
- `backend/prisma/migrations/0001_init/migration.sql` and `backend/prisma/migrations/0002_runtime_persistence_gap/migration.sql` exist.
- Required indexes on `time_entries(user_id, started_at)` and `time_entries(task_id)` exist.
- `.env.example` includes `DATABASE_URL`, session password, and AI key.
- `backend/utils/prisma.ts` provides the Prisma client singleton for Nitro runtime routes.
- Runtime API routes read and mutate PostgreSQL through Prisma-backed services in `backend/utils/store.ts`.
- `backend/prisma/seed.mjs` provides database seed/demo data and uses the same shared Breezy/medal derivation implementation as runtime refresh.
- All seven checked-in migrations apply to the disposable PostgreSQL integration database, and the database-backed suite covers 44 permission, timer, idle, context-switch, settings, edit, seed/auth, privacy, concurrency, and persistence checks.
- Migration `0008_remove_task_estimates` removes the deferred task-estimate field from the production schema.
- A live `/tracker/` browser verification against PostgreSQL now covers start, persisted pause/refresh/resume, a persisted split-as-break idle decision, feedback-before-stop ordering, and the final entry/feedback/blocker rows. Context persistence/restore was API-assisted with the exact authenticated count-only request because the controlled Browser did not emit a native `visibilitychange`; native background-tab behavior remains unverified in that run.

## Gaps

- Completed-entry UI/API editing is implemented, including audit rows and retryable derived refresh. Idle/context totals, idle decisions, and split-as-break pause windows intentionally remain server-authoritative rather than editable fields.
- Full client/project/category management and a stable calendar-week Journey aggregate remain deferred product gaps, not persistence blockers for the implemented core flows.

## Acceptance Criteria

- Fresh database migration creates the required schema.
- Seed data populates a realistic demo.
- Auth, tasks, timer entries, feedback, dashboards, Breezy Journey, medals, settings, and exports use persisted data.
- Manual/edit audit events are recorded.
- No billing/rate/earnings data exists in the schema.

## Tests And Verification

- Prisma validation.
- Migration apply against a clean PostgreSQL database.
- API integration tests backed by a test database.
- Export/dashboard verification against seeded persisted rows.
- PostgreSQL regression coverage includes consent-aware location/export, owner-only detailed DTOs, reduced collaborative summaries, idle idempotency/overlap, serialized timer transitions, and actual-break Breezy/medal semantics.
