# Time Tracker Agent Guide

This is an internal time tracking application with two equally important goals:

- Give each person a clear, exportable record of their own time, focus quality, blockers, and working patterns.
- Give the company aggregated process insight without turning personal data into individual performance rankings.

The original full build brief is preserved at `docs/spec.md`. Do not overwrite it when reorganizing specs. Feature-level specs live under `docs/specs/features/` and should be kept aligned with the original brief, the current implementation, and `docs/milestones.md`.

## Product Boundaries

Do not implement:

- Billable hours, hourly rates, earnings, salary rates, or client billing logic.
- Individual performance leaderboards or company views that rank people.
- Logging destination URLs, app names, website names, screenshots, or private activity details for context switches.
- A marketing landing page.
- Explanatory in-app copy about AI, hackathons, or implementation mechanics.
- Client-only persistence for production behavior. Client state is only for temporary UI state.

If scope has to be reduced, prioritize timer tracking, feedback/blockers, the personal dashboard, and Breezy/Breezy Journey. Record deferrals plainly in `docs/milestones.md`.

## Terminology

- Use `task` for trackable work.
- Use `time entry` or `entry` for a tracked or manual work session.
- Use `manual entry` for retroactive entries created after the fact.
- Use `blocker` for a user-selected source of friction.
- Use `Breezy day` for the derived daily Breezy mood and air clarity rollup.
- Use `company dashboard` only for aggregated process insight.

## Data Ownership And Privacy

- Individuals can see and export their own detailed raw data at any time.
- Company views must stay aggregated and process-focused.
- Shared tasks may show combined effort, per-contributor effort, and who is tracking now because the task is collaborative and opt-in.
- API routes must enforce authenticated access and task membership/ownership rules on the server. UI checks are helpful but are not sufficient.
- Context-switch tracking stores counts only.

## Technical Direction

Use the existing Nuxt 3 + Vue 3 + TypeScript stack with Nitro backend routes.

- Database target: PostgreSQL through Prisma.
- Runtime behavior should go through backend API routes.
- Prisma schema changes require migrations.
- Keep the architecture simple, readable, and scoped to the requested product surface.
- Prefer existing dependencies and local patterns. Add dependencies only when clearly justified.
- Keep authentication, task access, dashboards, exports, and Breezy rollups aligned with the data model.

Current implementation note: the running API uses PostgreSQL through Prisma-backed services in `backend/utils/store.ts`; `backend/prisma/seed.mjs` provides demo data. A clean PostgreSQL server is still required locally to apply migrations, seed, and exercise the runtime.

## Frontend Structure

Keep the app as an operational productivity tool, not a marketing site.

- Keep the top-level app shell responsible for navigation and high-level coordination.
- Split large UI areas into focused components as the implementation grows: authentication/profile, timer controls, task collaboration, feedback modal, dashboards, Breezy companion, Breezy Journey, medals, settings, and export.
- Put reusable domain types and time calculations in shared utilities.
- Keep API calls behind clear helper functions or composables where practical.
- Keep component templates focused on one responsibility.

## UI Direction

Use one consistent internal productivity theme across the app.

- Font stack: Catamaran, Cabin, then a system sans-serif fallback.
- Primary blue: `#1c75bc`.
- Dark blue: `#02579a`.
- Orange accent: `#fc7e10`.
- Clean white and light-blue surfaces.
- Responsive layouts for mobile and desktop.
- Light and dark mode support.

## Feature Specs

Feature specs are split from `docs/spec.md` and live under `docs/specs/features/`:

- `01-authentication-profile.spec.md`
- `02-tasks-categories-collaboration.spec.md`
- `03-timer-tracking-entries.spec.md`
- `04-feedback-blockers.spec.md`
- `05-idle-context-settings.spec.md`
- `06-personal-dashboard.spec.md`
- `07-company-dashboard.spec.md`
- `08-breezy-companion.spec.md`
- `09-breezy-journey.spec.md`
- `10-medals.spec.md`
- `11-raw-data-export.spec.md`
- `12-ai-insights.spec.md`
- `13-data-persistence-audit.spec.md`
- `14-accessibility-verification.spec.md`

Read the relevant feature spec before changing behavior in that area. If a feature spec conflicts with the preserved original brief, prefer the more specific feature spec and update the conflicting document in the same change.

## Migration Discipline

- Treat Prisma schema changes as migration-backed changes.
- Create a new Prisma migration for every database schema change.
- Do not edit existing migrations after they have been shared.
- Keep Prisma schema, generated client expectations, seed data, API behavior, and export shape aligned when schema changes affect user data.
- Do not add billable, rate, salary, or earnings columns.

## Quality Bar

- Add focused tests around permission boundaries and feature behavior you change.
- Use the fastest useful checks before reporting done.
- Prefer accessible controls: keyboard-accessible timer actions, labelled inputs, clear active tabs/filters, polite live regions for Breezy nudges, and reduced-motion support.
- Report evidence, limitations, and blocked external setup plainly.
- Never mark a milestone complete if the corresponding behavior is only partially implemented.

## Verification

Prefer this order for routine changes:

1. Inspect the relevant spec and implementation files.
2. Implement the smallest scoped change.
3. Run the fastest useful check, usually `npm.cmd run test` on Windows.
4. Run type/build/browser verification when the change touches shared types, Nuxt runtime behavior, or UI workflows.
5. Update docs or milestones when behavior, known gaps, or verification evidence changes.
