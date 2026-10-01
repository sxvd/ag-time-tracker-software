# AirGradient Time Tracker

Internal time tracking for AirGradient teams. The app helps each person keep a private, exportable record of their own work time, feedback, blockers, and work patterns while giving the company aggregate process insight without individual performance ranking.

## Description

AirGradient Time Tracker is a Nuxt 3, Vue 3, TypeScript, PostgreSQL, and Prisma application. It supports password-based AirGradient account access, timer tracking, manual entries, feedback and blockers, shared team tasks, personal and company dashboards, Work Journey, Breezy nudges, medals, settings, and CSV export.

Runtime data is persisted through backend API routes backed by PostgreSQL. Local development data, test data, and production data are separate databases.

## Getting Started

### Dependencies

- Node.js 20+.
- npm, using the committed `package-lock.json`.
- Docker Desktop for the local PostgreSQL database.
- A local `.env` file copied from `.env.example`.

### Installing

Clone or pull the repository, then enter the project checkout:

```bash
cd ag-time-tracker-software
npm install
cp .env.example .env
```

Confirm `.env` includes local database and session settings:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public"
NUXT_SESSION_PASSWORD="local-dev-session-secret-32-characters"
NUXT_ALLOW_SELF_REGISTRATION="true"
NUXT_APP_BASE_URL="/tracker/"
```

### Running Locally With DB

Start PostgreSQL, apply migrations, seed demo data, and run the Nuxt dev server:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml up -d postgres
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open:

```text
http://localhost:3000/tracker/
```

Seeded demo users:

```text
siri@airgradient.com
jack@airgradient.com
jay@airgradient.com
```

Password:

```text
demo-password
```

If port `3000` is already in use:

```bash
npm run dev -- --port 3100
```

Then open:

```text
http://localhost:3100/tracker/
```

## Account Flow

The signed-out page opens directly to the account card.

- `Sign in` is for existing accounts and asks for work email and password.
- `Register` creates a missing `@airgradient.com` account when self-registration is enabled.
- Register asks for work email, name, team, and password.
- Team uses the same canonical list as task categories: Software, Hardware, Firmware, Communication, Research, Commerce, Production, Other.
- Passwords must contain 8-1,024 characters.
- Passwords are stored only as salted server-side scrypt hashes.
- `Sign in` never creates a missing account.
- Set `NUXT_ALLOW_SELF_REGISTRATION=false` to disable new account registration while keeping existing-account sign-in available.

This password-only flow validates the email domain but does not verify mailbox ownership. Keep production inside the trusted internal access boundary until mailbox verification or a stronger authentication factor is added.

## Main User Workflow

1. Sign in or register with an `@airgradient.com` account.
2. Create an individual task inline, or create a shared task from `New team task`.
3. Choose a category/team area such as Software, Hardware, Firmware, Communication, Research, Commerce, Production, or Other.
4. Start, pause, resume, and stop the timer.
5. Review inactive time if the app detects a gap.
6. Stop the timer and optionally add feedback, blockers, and a note.
7. Review `Today's entries`.
8. Add a manual entry for work tracked after the fact.
9. Open Personal dashboard for weekly personal hours, work overview, work signals, blockers, medals, and CSV export.
10. Open Company dashboard for aggregate category-level process insight.
11. Open Work Journey to revisit completed tasks across the selected week.

## Shared Task Workflow

Shared work is represented as Team tasks.

- `New team task` requires selecting at least one existing teammate.
- Creating a Team task does not start the timer.
- A Team task appears for the owner under `Today's entries` -> `Team`.
- Invitees see a task invitation notification and can choose `Join`.
- Joining a task adds it to the user's Team entries but still does not start the timer.
- `Track task` loads the Team task into the timer draft.
- Before tracking starts, `Cancel` clears that draft.
- Each person tracks only their own time on the shared task.
- Team task rows show members and `My time spent`, not other members' durations.

## Dashboard And Reporting

Personal dashboard is private to the signed-in user and focuses on that user's work record.

- Weekly hours and work overview.
- Customizable metric/grouping chart.
- Work signals from saved feedback.
- Blocker patterns.
- Medals.
- CSV export.

Company dashboard is aggregate and process-focused.

- It must not rank people.
- It must not expose personal raw entries.
- It should use category/team-level rollups and shared-task aggregate signals.

Work Journey is a weekly timeline of completed work entries. It is designed to help the user review what they completed, how time was distributed across the week, and the feedback/blocker context attached to each entry.

## Production Data Note

Production data is not the same as local seed data or test fixtures.

- `npm run db:seed` is for local/demo development only.
- Production deploy runs migrations but does not seed demo tasks and entries automatically.
- A production account can exist and still show empty dashboards if that user has not tracked work in production.
- Test fixture names such as `Mog` may exist in tests or local data without existing in production, unless that account was created in the production database.

To inspect production data, connect to the production server first. The production `.env.production` file and PostgreSQL Docker volume live on that server, not in the local worktree.

## Useful Local Commands

Check local containers:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml ps
```

Check local API health:

```bash
curl http://localhost:3000/tracker/api/health
```

Seed local demo data:

```bash
npm run db:seed
```

Stop local development containers:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml down
```

Run checks:

```bash
npm run test
npm run test:component
npm run test:integration
npm run lint
npm run build
docker compose -f docker-compose.prod.yml --env-file .env.example config
```

## Docker Development

Run PostgreSQL and the Nuxt dev server through Docker:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml up --build web
```

Seed the Docker development database:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml exec web npm run db:seed
```

Run tests inside Docker:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
```

## Project Structure

```text
backend/
  api/         Nitro API routes for auth, timer, tasks, entries, dashboards, export, and sharing
  prisma/      Prisma schema, migrations, and seed data
  utils/       Auth, validation, DB store, timer activity, dashboard, and account helpers

frontend/
  app.vue      App shell, navigation, and high-level workflow coordination
  features/    Feature UI modules for auth, tracking, tasks, dashboards, Breezy, settings, and export
  components/  Shared UI components such as charts and modals
  composables/ Frontend API/session/theme helpers
  assets/      Main CSS theme and layout styles
  public/      Logo and Breezy assets

shared/
  constants/   Shared category/team and settings constants
  types/       Shared TypeScript domain types
  utils/       Shared time, URL, theme, and Breezy helpers

docs/
  spec.md          Preserved full product brief and current high-level behavior
  specs/features/  Feature-level specs that should stay aligned with implementation
  operations/      Production runbooks

tests/
  unit/        Pure logic and API helper tests
  component/   Vue component and app workflow tests
  integration/ Database-backed API and permission tests

scripts/       Production/config helper scripts
```

## Feature Specs

Feature behavior is documented in `docs/specs/features/`.

Key files for the current product surface:

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
- `13-data-persistence-audit.spec.md`
- `14-accessibility-verification.spec.md`

Read the relevant feature spec before changing behavior in that area.

## Troubleshooting

If login fails with `Environment variable not found: DATABASE_URL`, the Nuxt dev server is running without the local `.env` loaded. Stop the server, confirm `.env` exists in this worktree, then start `npm run dev` again.

If Docker reports a container-name or port conflict, stop duplicate dev services and keep one Compose project name:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml down
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml up -d postgres
```

If the app loads but the page does not respond to clicks during local testing, restart the Nuxt dev server. Running `nuxt prepare`, tests, or type generation while the dev server is active can regenerate `.nuxt` and leave the browser on an old dev bundle.

If production sign-in works but dashboards are empty, check whether that production user has production tasks and entries. Local seed data and test fixture data do not appear in production automatically.

## Production Deployment

The AirGradient tools host serves:

```text
https://tools.airgradient.net/tracker
```

Production Compose runs its own PostgreSQL container and stores data in the `postgres_data` Docker volume. The deploy script creates a server-only `.env.production` with generated secrets on first run. Do not commit `.env.production`.

Expected production environment values:

```dotenv
POSTGRES_DB="ag_time_tracker"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="replace-with-a-long-url-safe-secret"
NUXT_SESSION_PASSWORD="prod-example-session-secret-32-characters"
NUXT_ALLOW_SELF_REGISTRATION="true"
PORT="5500"
NITRO_HOST="0.0.0.0"
NUXT_APP_BASE_URL="/tracker/"
```

The production scheduler invokes the deployment script from the production checkout. The script pulls the latest fast-forward `main`, builds a uniquely timestamped image, runs Prisma migrations, and starts the web container:

```bash
./deploy.sh
```

The Docker build runs `npm run verify:production` inside the build container, so the production server does not need Node.js or npm installed for deployment.

Every production migration and deployment must follow `docs/operations/production-runbook.md`. The runbook covers backups, migration status, health checks, rollback, and isolated restore.

## Production DB Checks

Run production DB checks only after SSHing into the production server and entering the production checkout. The default runbook path is:

```bash
cd /opt/apps/tracker
```

Confirm services:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Check known users without printing secrets:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres \
  psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-ag_time_tracker}" \
  -c "select email, display_name, team, created_at from users order by created_at desc limit 20;"
```

Check whether a user has production tasks and entries:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres \
  psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-ag_time_tracker}" \
  -c "select u.email, count(distinct t.id) as tasks, count(distinct e.id) as entries from users u left join tasks t on t.owner_id = u.id left join time_entries e on e.user_id = u.id where u.email ilike '%mog%' group by u.email;"
```

Never paste `.env.production`, database passwords, session secrets, or raw production exports into chat, tickets, or logs.
