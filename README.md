# AirGradient Time Tracker

Internal time tracking for AirGradient teams, with personal raw-data ownership and company-level aggregate insight.

## Description

AirGradient Time Tracker helps AirGradient employees and freelancers track tasks, record work sessions, capture feedback and blockers, review personal weekly patterns, and inspect company-level process signals without ranking individuals. The app is built with Nuxt 3, Vue 3, TypeScript, PostgreSQL, and Prisma. Runtime data is persisted through backend API routes, while the frontend is split into feature-focused modules for tracking, tasks, dashboards, Breezy, settings, and account workflows.

## Getting Started

### Dependencies

- Node.js 20+.
- Docker Desktop, used for the local PostgreSQL database.
- npm, using the committed `package-lock.json`.
- PostgreSQL connection details in a local `.env` file.

### Installing

From this worktree:

```bash
cd /Users/Ananya/Developer/ag-time-tracker-software/.worktrees/backend-database-hardening
npm install
cp .env.example .env
```

Confirm `.env` includes the local database and session settings:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public"
NUXT_SESSION_PASSWORD="local-dev-session-secret-32-characters"
NUXT_ALLOW_SELF_REGISTRATION="true"
```

### Executing Program

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

Sign in with the seeded demo user:

- Email: `siri@airgradient.com`
- Password: `demo-password`

If port `3000` is already in use, run the web app on another port:

```bash
npm run dev -- --port 3100
```

Then open:

```text
http://localhost:3100/tracker/
```

Development and production allow an `@airgradient.com` user to be created automatically on first sign-in. Passwords must contain 8–1,024 characters and are stored only as uniquely salted server-side scrypt hashes. Set `NUXT_ALLOW_SELF_REGISTRATION=false` to restrict sign-in to accounts that already exist in PostgreSQL.

## Docker Development

Start PostgreSQL and the Nuxt dev server through Docker:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml up --build web
```

Seed the Docker development database:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml exec web npm run db:seed
```

Run the test suite inside Docker:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
```

Stop the Docker development containers:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml down
```

## Help

Check that the local database container is running:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml ps
```

Check that the API can reach PostgreSQL:

```bash
curl http://localhost:3000/api/health
```

If login fails and the API reports `Environment variable not found: DATABASE_URL`, the Nuxt dev server is running without the local `.env` loaded. Stop the dev server, confirm `.env` exists in this worktree, then start `npm run dev` again.

If you see Docker container-name or port conflicts, stop duplicate dev services and keep one Compose project name:

```bash
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml down
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml up -d postgres
```

The app uses PostgreSQL through Prisma for runtime persistence. The Prisma seed script populates demo users, tasks, entries, feedback, blockers, dashboards, Work Journey data, and medals.

## Project Structure

```text
backend/
  api/         Nuxt/Nitro API routes for auth, timer, entries, dashboards, export, and sharing
  prisma/      Prisma schema, migrations, and seed data
  utils/       Auth, validation, DB store, timer activity, and dashboard logic

frontend/
  app.vue      App shell, navigation, and high-level workflow coordination
  features/    Feature UI modules for auth, tracking, tasks, dashboards, Breezy, settings
  components/  Shared UI components such as charts and modals
  composables/ Frontend API/session/theme helpers
  assets/      Main CSS theme and layout styles
  public/      Logo and mascot assets

shared/
  constants/   Shared category constants
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

## Checks

```bash
npm run test
npm run test:component
npm run test:integration
npm run lint
npm run build
docker compose -p ag-time-tracker-software -f docker-compose.dev.yml run --rm test
docker compose -f docker-compose.prod.yml --env-file .env.example config
```

## Demo Workflow

1. Sign in as `siri@airgradient.com`.
2. Create or select a task.
3. Choose a category such as Software, Hardware, Firmware, Communication, Research, Commerce, Production, or Other.
4. Start the timer and watch Breezy reflect the current work state.
5. Pause, resume, or handle inactive time if needed.
6. Stop the timer, then optionally add feedback and blockers.
7. Review Today's entries and confirm the saved session appears.
8. Add a Manual entry if work was tracked after the fact.
9. Open Personal dashboard to review the selected week's hours, work overview, work signals, blockers, medals, and CSV export.
10. Open Company dashboard to review aggregated category-level insights without individual ranking.
11. Open Work Journey to revisit completed tasks across the selected week.
12. Export CSV from the Personal dashboard header.

## Docker Production Deployment

The AirGradient tools host deploys the app below:

```text
https://tools.airgradient.net/tracker
```

Production Compose starts its own PostgreSQL container and keeps data in the `postgres_data` Docker volume. The deploy script creates a server-only `.env.production` with generated secrets on first run, so do not commit that file.

Optional `.env.production` overrides:

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

Production authentication uses the same password flow as development. A missing `@airgradient.com` account is created automatically when self-registration is enabled; an existing account must supply its correct password. Sessions use an HTTP-only cookie and a persisted, hashed session token. `NUXT_SESSION_PASSWORD` must be a unique production secret containing at least 32 characters.

This password-only flow validates the email domain but does not verify mailbox ownership. Keep the deployment inside the trusted internal access boundary until mailbox verification or a stronger authentication factor is implemented.

Before first deployment, confirm the shared Docker network exists:

```bash
docker network ls
```

The tools host Nginx route should proxy `/tracker` to:

```text
http://tracker:5500
```

Every production migration and deployment must follow the [mandatory production runbook](docs/operations/production-runbook.md). Production automation pulls the latest fast-forward update from `main`, creates a unique timestamped image, and deploys it after the required backup and migration gates. Keep `main` protected so only reviewed, tested changes can trigger production deployment.

The production scheduler invokes the deployment script from `/opt/apps/tracker` without requiring a manually supplied Git SHA:

```bash
./deploy.sh
```
