# Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Docker packaging, local Docker development, and production deployment support for the Nuxt 3 + Prisma AirGradient Time Tracker app on `tools.airgradient.net`.

**Architecture:** Use one multi-stage `Dockerfile` with separate `dev`, `build`, and `runner` targets. Use two Compose files: `docker-compose.dev.yml` for local app plus PostgreSQL development, and `docker-compose.prod.yml` for the production web container plus a one-shot migration service on the external `app-network`.

**Tech Stack:** Nuxt 3, Nitro node-server, Vue 3, TypeScript, Prisma, PostgreSQL, Docker Compose, Debian Node.js runtime image for Prisma OpenSSL compatibility.

---

## Decision: One Dockerfile, Two Compose Workflows

Use one Dockerfile, not two unrelated Dockerfiles.

Create two Docker workflows:

- Development: `docker-compose.dev.yml` runs the app in Nuxt dev mode and starts a local PostgreSQL container.
- Deployment: `docker-compose.prod.yml` builds the production Nitro server, runs Prisma migrations, and starts the app container on the shared AirGradient `app-network`.

This keeps the build logic shared while still giving development and production different runtime behavior. The production deployment should not run the dev server, should not mount local source files, and should not seed demo data automatically.

Recommended deployment defaults for the AirGradient tools host:

- Public path: `https://tools.airgradient.net/aq-time-tracker`
- Container/network alias: `aq-time-tracker`
- App port: `5300`
- Server path: `/opt/apps/aq-time-tracker`
- Production database: external PostgreSQL through `DATABASE_URL` in `.env.production`

If AirGradient assigns a different public path, alias, or port, replace all occurrences of `aq-time-tracker` and `5300` in the implementation with the assigned values before deploying.

---

## File Structure

- Create: `.dockerignore`
  - Keeps local build output, dependencies, logs, and secrets out of Docker build context.
- Create: `Dockerfile`
  - Defines reusable `deps`, `dev`, `build`, and `runner` stages.
- Create: `docker-compose.dev.yml`
  - Runs local development app and PostgreSQL.
- Create: `docker-compose.prod.yml`
  - Runs production web container, migration job, and `app-network` alias.
- Create: `deploy.sh`
  - Pulls changes, builds the production image when source changed, runs migrations, and starts the web container.
- Create: `backend/api/health.get.ts`
  - Provides a lightweight database-backed health endpoint for Docker verification.
- Modify: `nuxt.config.ts`
  - Allows deployment below `/aq-time-tracker/` by reading `NUXT_APP_BASE_URL`.
- Modify: `.env.example`
  - Documents Docker development and production variables without storing secrets.
- Modify: `README.md`
  - Documents Docker development and deployment commands.

---

### Task 1: Add Docker Build Context Controls

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

Create `.dockerignore` with this exact content:

```dockerignore
.git
.codex
.agents
.nuxt
.output
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.env
.env.*
!.env.example
artifacts
docs/example_UI
coverage
dist
tmp
*.local
```

- [ ] **Step 2: Verify Docker context exclusions**

Run:

```powershell
Get-Content .dockerignore
```

Expected: the file contains `.env.*` and `!.env.example`, so real environment files are excluded while the example remains visible.

- [ ] **Step 3: Commit**

Run:

```bash
git add .dockerignore
git commit -m "chore: add docker build context exclusions"
```

Expected: commit succeeds when the workspace is a Git repository.

---

### Task 2: Add Multi-Stage Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create `Dockerfile`**

Create `Dockerfile` with this exact content:

```dockerfile
FROM node:22-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY . .
RUN npx prisma generate --schema=backend/prisma/schema.prisma
ENV NODE_ENV=development
ENV NITRO_HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
COPY . .
ENV NODE_ENV=production
RUN npx prisma generate --schema=backend/prisma/schema.prisma
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV PORT=5300

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build /app/.output ./.output
COPY --from=build /app/backend/prisma ./backend/prisma
RUN npx prisma generate --schema=backend/prisma/schema.prisma

EXPOSE 5300
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Build the development target**

Run:

```bash
docker build --target dev -t ag-time-tracker:dev .
```

Expected: Docker builds the image and the Prisma generate step succeeds.

- [ ] **Step 3: Build the production target**

Run:

```bash
docker build --target runner -t ag-time-tracker:prod .
```

Expected: Docker builds the image and `npm run build` succeeds inside the build stage.

- [ ] **Step 4: Commit**

Run:

```bash
git add Dockerfile
git commit -m "chore: add multi-stage dockerfile"
```

Expected: commit succeeds when the workspace is a Git repository.

---

### Task 3: Make Nuxt Base Path Configurable

**Files:**
- Modify: `nuxt.config.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update `nuxt.config.ts`**

Replace the current `app` block in `nuxt.config.ts` with this block:

```ts
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      title: 'AirGradient Time Tracker',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'AirGradient internal time tracking with Breezy.' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Catamaran:wght@500;600;700;800&family=Cabin:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap' }
      ]
    }
  },
```

- [ ] **Step 2: Update `.env.example`**

Replace `.env.example` with this exact content:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ag_time_tracker?schema=public"
NUXT_SESSION_PASSWORD="local-dev-session-secret-32-characters"
NUXT_AI_INSIGHTS_API_KEY=""

# Local Docker development
POSTGRES_DB="ag_time_tracker"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="postgres"

# Production deployment below https://tools.airgradient.net/aq-time-tracker
PORT="5300"
NITRO_HOST="0.0.0.0"
NUXT_APP_BASE_URL="/aq-time-tracker/"
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run lint
```

Expected: Nuxt typecheck passes.

- [ ] **Step 4: Commit**

Run:

```bash
git add nuxt.config.ts .env.example
git commit -m "chore: support docker deployment base path"
```

Expected: commit succeeds when the workspace is a Git repository.

---

### Task 4: Add Docker Development Compose

**Files:**
- Create: `docker-compose.dev.yml`

- [ ] **Step 1: Create `docker-compose.dev.yml`**

Create `docker-compose.dev.yml` with this exact content:

```yaml
services:
  postgres:
    image: postgres:16-bookworm
    container_name: ag-time-tracker-postgres-dev
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-ag_time_tracker}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER:-postgres} -d $${POSTGRES_DB:-ag_time_tracker}"]
      interval: 5s
      timeout: 5s
      retries: 12

  web:
    build:
      context: .
      target: dev
    container_name: ag-time-tracker-web-dev
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/${POSTGRES_DB:-ag_time_tracker}?schema=public
      NUXT_SESSION_PASSWORD: ${NUXT_SESSION_PASSWORD:-local-docker-session-secret-32-characters}
      NUXT_AI_INSIGHTS_API_KEY: ${NUXT_AI_INSIGHTS_API_KEY:-}
      NITRO_HOST: 0.0.0.0
      PORT: 3000
      NUXT_APP_BASE_URL: /
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - node_modules:/app/node_modules
      - nuxt_cache:/app/.nuxt
    command: >
      sh -c "npx prisma migrate deploy --schema=backend/prisma/schema.prisma
      && npm run dev -- --host 0.0.0.0"

volumes:
  postgres_data:
  node_modules:
  nuxt_cache:
```

- [ ] **Step 2: Start local Docker development**

Run:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Expected: PostgreSQL becomes healthy, Prisma migrations run, and Nuxt is available at `http://localhost:3000`.

- [ ] **Step 3: Seed local Docker database**

In a second terminal, run:

```bash
docker compose -f docker-compose.dev.yml exec web npm run db:seed
```

Expected: seed completes and the demo login `siri@airgradient.com` with password `demo` works.

- [ ] **Step 4: Stop local Docker development**

Run:

```bash
docker compose -f docker-compose.dev.yml down
```

Expected: containers stop and the `postgres_data` volume keeps local database data.

- [ ] **Step 5: Commit**

Run:

```bash
git add docker-compose.dev.yml
git commit -m "chore: add docker development compose"
```

Expected: commit succeeds when the workspace is a Git repository.

---

### Task 5: Add Health Endpoint

**Files:**
- Create: `backend/api/health.get.ts`

- [ ] **Step 1: Create `backend/api/health.get.ts`**

Create `backend/api/health.get.ts` with this exact content:

```ts
import { prisma } from '../utils/prisma'

export default defineEventHandler(async () => {
  await prisma.$queryRaw`SELECT 1`

  return {
    status: 'ok',
    service: 'ag-time-tracker',
    checkedAt: new Date().toISOString()
  }
})
```

- [ ] **Step 2: Add a focused health endpoint test**

Create `tests/health.test.ts` with this exact content:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('../backend/utils/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(async () => [{ '?column?': 1 }])
  }
}))

describe('health endpoint', () => {
  it('returns an ok status after a database ping', async () => {
    const handler = (await import('../backend/api/health.get')).default
    const result = await handler({} as never)

    expect(result).toMatchObject({
      status: 'ok',
      service: 'ag-time-tracker'
    })
    expect(new Date(result.checkedAt).toString()).not.toBe('Invalid Date')
  })
})
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
npm run test -- tests/health.test.ts
```

Expected: the health endpoint test passes.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add backend/api/health.get.ts tests/health.test.ts
git commit -m "chore: add container health endpoint"
```

Expected: commit succeeds when the workspace is a Git repository.

---

### Task 6: Add Production Compose For AirGradient Tools Host

**Files:**
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Create `docker-compose.prod.yml`**

Create `docker-compose.prod.yml` with this exact content:

```yaml
services:
  web:
    build:
      context: .
      target: runner
    image: ag-time-tracker:${IMAGE_TAG:-local}
    container_name: aq-time-tracker
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
      NITRO_HOST: 0.0.0.0
      PORT: 5300
      NUXT_APP_BASE_URL: /aq-time-tracker/
    ports:
      - "5300:5300"
    healthcheck:
      test: ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:5300/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      default:
      app-network:
        aliases:
          - aq-time-tracker

  migrate:
    build:
      context: .
      target: runner
    image: ag-time-tracker:${IMAGE_TAG:-local}
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
    command: ["npx", "prisma", "migrate", "deploy", "--schema=backend/prisma/schema.prisma"]
    profiles:
      - tools

networks:
  app-network:
    external: true
    name: app-network
```

- [ ] **Step 2: Validate Compose syntax**

Run:

```bash
docker compose -f docker-compose.prod.yml config
```

Expected: Compose prints the resolved configuration and includes the external `app-network`.

- [ ] **Step 3: Build production image through Compose**

Run:

```bash
IMAGE_TAG=local docker compose -f docker-compose.prod.yml build web
```

Expected: the `web` image builds successfully.

- [ ] **Step 4: Commit**

Run:

```bash
git add docker-compose.prod.yml
git commit -m "chore: add production docker compose"
```

Expected: commit succeeds when the workspace is a Git repository.

---

### Task 7: Add Deployment Script

**Files:**
- Create: `deploy.sh`

- [ ] **Step 1: Create `deploy.sh`**

Create `deploy.sh` with this exact content:

```bash
#!/bin/bash

echo "Deployment started at $(date)"

set -euo pipefail

APP_DIR="/opt/apps/aq-time-tracker"
FORCE=false

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -f|--force) FORCE=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

echo "Navigating to $APP_DIR"
cd "$APP_DIR"

echo "Pulling latest changes"
PULL_OUTPUT=$(git pull 2>&1)
echo "$PULL_OUTPUT"

if [[ "$PULL_OUTPUT" == *"Already up to date."* && "$PULL_OUTPUT" != *"[new tag]"* && "$FORCE" == false ]]; then
  echo "No changes found and no new tags. Exiting (use -f to force)."
  exit 0
fi

echo "Generating version.json"
GIT_TAG=$(git describe --tags 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
IMAGE_TAG=$(git rev-parse --short HEAD 2>/dev/null || echo "local")

cat <<EOF > version.json
{
  "gitTag": "$GIT_TAG",
  "buildDate": "$BUILD_DATE"
}
EOF

echo "Building production image"
IMAGE_TAG="$IMAGE_TAG" docker compose -f docker-compose.prod.yml --env-file .env.production build web

echo "Running database migrations"
IMAGE_TAG="$IMAGE_TAG" docker compose -f docker-compose.prod.yml --env-file .env.production --profile tools run --rm migrate

echo "Starting web container"
IMAGE_TAG="$IMAGE_TAG" docker compose -f docker-compose.prod.yml --env-file .env.production up -d web

echo "Deployment completed successfully."
```

- [ ] **Step 2: Make script executable on Unix systems**

Run:

```bash
chmod +x deploy.sh
```

Expected: `deploy.sh` has executable permissions on Linux and macOS.

- [ ] **Step 3: Validate script syntax**

Run:

```bash
bash -n deploy.sh
```

Expected: no syntax errors.

- [ ] **Step 4: Commit**

Run:

```bash
git add deploy.sh
git commit -m "chore: add production deploy script"
```

Expected: commit succeeds when the workspace is a Git repository.

---

### Task 8: Document Docker Usage

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Docker development section to `README.md`**

Insert this section after the existing local run instructions:

````markdown
## Docker Development

Start PostgreSQL and the Nuxt dev server through Docker:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Seed the local Docker database:

```bash
docker compose -f docker-compose.dev.yml exec web npm run db:seed
```

Open `http://localhost:3000` and sign in with:

- Email: `siri@airgradient.com`
- Password: `demo`

Stop the development containers:

```bash
docker compose -f docker-compose.dev.yml down
```
````

- [ ] **Step 2: Add production deployment section to `README.md`**

Insert this section after the Docker development section:

````markdown
## Docker Production Deployment

The AirGradient tools host deploys the app below:

```text
https://tools.airgradient.net/aq-time-tracker
```

Production expects `.env.production` on the server with at least:

```dotenv
DATABASE_URL="postgresql://user:password@host:5432/ag_time_tracker?schema=public"
NUXT_SESSION_PASSWORD="prod-example-session-secret-32-characters"
NUXT_AI_INSIGHTS_API_KEY=""
PORT="5300"
NITRO_HOST="0.0.0.0"
NUXT_APP_BASE_URL="/aq-time-tracker/"
```

Deploy from `/opt/apps/aq-time-tracker`:

```bash
./deploy.sh
```

Force a rebuild and restart:

```bash
./deploy.sh --force
```
````

- [ ] **Step 3: Review Markdown rendering**

Run:

```bash
npm run test
```

Expected: tests still pass after documentation changes.

- [ ] **Step 4: Commit**

Run:

```bash
git add README.md
git commit -m "docs: document docker workflows"
```

Expected: commit succeeds when the workspace is a Git repository.

---

### Task 9: Verify End-To-End Docker Behavior

**Files:**
- No file changes.

- [ ] **Step 1: Run project tests**

Run:

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 2: Run Nuxt typecheck**

Run:

```bash
npm run lint
```

Expected: Nuxt typecheck passes.

- [ ] **Step 3: Build Nuxt locally**

Run:

```bash
npm run build
```

Expected: Nuxt production build succeeds.

- [ ] **Step 4: Build production Docker image**

Run:

```bash
docker build --target runner -t ag-time-tracker:verify .
```

Expected: production Docker image builds successfully.

- [ ] **Step 5: Run local Docker development workflow**

Run:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Expected: app starts on `http://localhost:3000` and logs show Prisma migrations completed.

- [ ] **Step 6: Seed and verify login**

In a second terminal, run:

```bash
docker compose -f docker-compose.dev.yml exec web npm run db:seed
```

Expected: seed succeeds and the demo user can sign in at `http://localhost:3000`.

- [ ] **Step 7: Stop development containers**

Run:

```bash
docker compose -f docker-compose.dev.yml down
```

Expected: containers stop cleanly.

- [ ] **Step 8: Commit verification notes if needed**

If verification discovers a repeatable setup requirement, update `README.md` with the exact command and commit:

```bash
git add README.md
git commit -m "docs: clarify docker verification"
```

Expected: README contains only verified setup information.

---

## Production Deployment Notes

- Do not commit `.env.production`.
- Do not run `npm run db:seed` automatically in production.
- Run `docker network ls` on `tools.airgradient.net` and confirm `app-network` exists before first deployment.
- Confirm the Nginx upstream path on `tools.airgradient.net` proxies `/aq-time-tracker` to `http://aq-time-tracker:5300`.
- Confirm port `5300` is not already assigned to another installed app before first deployment.
- Confirm the production `DATABASE_URL` points to the intended PostgreSQL database before running `./deploy.sh`.
- Keep Prisma migrations in `backend/prisma/migrations` and use a concrete migration name such as `npx prisma migrate dev --schema=backend/prisma/schema.prisma --name add_container_runtime_setting` only when the schema changes.

## Rollback Notes

The deploy script tags the image with the current Git short SHA. To roll back, check available local images on the server:

```bash
docker images ag-time-tracker
```

Then start a known previous image tag manually. This example uses `abc1234` as the previous image tag shown by `docker images ag-time-tracker`:

```bash
IMAGE_TAG=abc1234 docker compose -f docker-compose.prod.yml --env-file .env.production up -d web
```

Database migrations are forward-only by default. For a schema-changing release, prepare a data-safe rollback plan before deploying.

## Self-Review

- Spec coverage: The plan covers Docker build context, image build, local development, production Compose, deployment script, base-path support, health endpoint, docs, and verification.
- Placeholder scan: The plan avoids placeholder tokens and includes concrete file contents, commands, and expected results.
- Type consistency: The service name `web`, image name `ag-time-tracker`, network alias `aq-time-tracker`, app port `5300`, and base path `/aq-time-tracker/` are used consistently across Docker, Compose, deploy script, Nuxt config, and README examples.
