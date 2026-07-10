# AirGradient Time Tracker

Internal time tracking for AirGradient teams and freelancers, with personal raw-data ownership and company-level aggregate insight.

## Run Locally

```powershell
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000` and sign in with the seeded demo user:

- Email: `siri@airgradient.com`
- Password: `demo`

The app uses PostgreSQL through Prisma for runtime persistence. Configure `DATABASE_URL` from `.env.example` before running migrations or the app. The Prisma seed script populates demo users, tasks, entries, feedback, blockers, dashboards, Breezy Journey data, and medals.

## Docker Development

Run the unit test suite inside Docker:

```bash
docker compose -f docker-compose.dev.yml run --rm test
```

Start PostgreSQL and the Nuxt dev server through Docker:

```bash
docker compose -f docker-compose.dev.yml up --build web
```

Seed the Docker development database:

```bash
docker compose -f docker-compose.dev.yml exec web npm run db:seed
```

Open `http://localhost:3000` and sign in with:

- Email: `siri@airgradient.com`
- Password: `demo`

Stop the Docker development containers:

```bash
docker compose -f docker-compose.dev.yml down
```

## Docker Production Deployment

The AirGradient tools host deploys the app below:

```text
https://tools.airgradient.net/aq-time-tracker
```

Production Compose starts its own PostgreSQL container and keeps data in the `postgres_data` Docker volume. The deploy script creates a server-only `.env.production` with generated secrets on first run, so do not commit that file.

Optional `.env.production` overrides:

```dotenv
POSTGRES_DB="ag_time_tracker"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="replace-with-a-long-url-safe-secret"
NUXT_SESSION_PASSWORD="prod-example-session-secret-32-characters"
NUXT_AI_INSIGHTS_API_KEY=""
PORT="5500"
NITRO_HOST="0.0.0.0"
NUXT_APP_BASE_URL="/aq-time-tracker/"
```

Before first deployment, confirm the shared Docker network exists:

```bash
docker network ls
```

The tools host Nginx route should proxy `/aq-time-tracker` to:

```text
http://aq-time-tracker:5500
```

Deploy from `/opt/apps/tracker`:

```bash
./deploy.sh
```

Force a rebuild and restart:

```bash
./deploy.sh --force
```

## Checks

```bash
npm run test
npm run build
docker compose -f docker-compose.dev.yml run --rm test
docker compose -f docker-compose.prod.yml --env-file .env.example config
```

## Hackathon Demo Script

1. Sign in as `siri@airgradient.com`.
2. Create or select a Deep work task.
3. Start the timer and watch Breezy encourage focus.
4. Pause and resume the timer.
5. Stop the timer, choose `Great flow`, select a blocker, and save feedback.
6. Confirm Breezy celebrates and a clear-air Breezy day is visible.
7. Add a retroactive entry and confirm it is marked manual.
8. Open the personal dashboard and review hours, quality, blockers, and estimate vs actual.
9. Open the Breezy Journey and confirm month-labelled weekly points.
10. Switch to the company dashboard and filter by team.
11. Run AI Insights for one personal and one company suggestion.
12. Export CSV and JSON raw data.
