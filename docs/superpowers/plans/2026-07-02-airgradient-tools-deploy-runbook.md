# AirGradient Tools Deploy Runbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the current AirGradient Time Tracker repository to the existing `tools.airgradient.net` Docker host at `https://tools.airgradient.net/aq-time-tracker`.

**Architecture:** The Docker host, Nginx proxy, and shared Docker network are provided by AirGradient infrastructure. This repository supplies the app image build, production PostgreSQL service with a persistent Docker volume, Prisma migration runner, and `deploy.sh`; the server pulls the repo, builds when source changes, runs migrations, and starts the `web` container on `app-network`.

**Tech Stack:** Nuxt 3, Nitro node server, Vue 3, TypeScript, Prisma, PostgreSQL, Docker Compose, Bash.

---

## Current Repository Status

The repository already contains the deployment files needed by the AirGradient tools host:

- `Dockerfile`
  - Builds the Nuxt/Nitro production server with Prisma support.
  - Exposes port `5500` in the `runner` target.
- `docker-compose.prod.yml`
  - Starts a PostgreSQL container named `aq-time-tracker-postgres`.
  - Persists database data in the `postgres_data` Docker volume.
  - Builds service `web`.
  - Uses container name `aq-time-tracker`.
  - Joins external Docker network `app-network`.
  - Adds network alias `aq-time-tracker`.
  - Runs the app on `5500`.
  - Defines a one-shot `migrate` service for `prisma migrate deploy`.
- `deploy.sh`
  - Uses server path `/opt/apps/tracker`.
  - Creates `.env.production` with generated secrets on first run.
  - Rewrites a local `localhost:5432` production `DATABASE_URL` to the Compose PostgreSQL service.
  - Runs `git pull`.
  - Skips rebuild when no source changes are found unless `--force` is used.
  - Writes `version.json`.
  - Builds `web`, runs migrations, and starts `web`.
- `.dockerignore`
  - Excludes real `.env` files, local build output, dependencies, artifacts, and logs from the Docker build context.
- `backend/api/health.get.ts`
  - Pings PostgreSQL with Prisma and returns service health.
- `.env.example` and `README.md`
  - Document production variables, public path, port, and expected Nginx upstream.
- `tests/unit/deployment-config.test.ts`
  - Guards the expected path, alias, port, network, and deploy script commands.

Local verification completed while writing this runbook:

- `npm.cmd run test -- tests/unit/deployment-config.test.ts`: passed, 4 tests.
- `bash -n deploy.sh`: passed.
- `npm.cmd run build`: passed with dependency deprecation warnings only.
- `docker compose -f docker-compose.prod.yml config`: blocked locally because `.env.production` is intentionally absent.

Open requirements before production deployment:

- Real SSH access to `root@tools.airgradient.net`.
- A real Git repository clone on the server; this local workspace has an incomplete `.git` directory and `git rev-parse --show-toplevel` fails locally.
- A server-only `.env.production` file, created automatically by `deploy.sh` if absent.
- The production PostgreSQL container and `postgres_data` volume, created automatically by Docker Compose.
- Nginx route `/aq-time-tracker` proxying to `http://aq-time-tracker:5500`.
- `app-network` must exist on the Docker host.
- Cron or scheduler must call `/opt/apps/tracker/deploy.sh`.

---

### Task 1: Confirm The Deployment Contract With AirGradient Ops

**Files:**
- Inspect: `docker-compose.prod.yml`
- Inspect: `Dockerfile`
- Inspect: `.env.example`
- Inspect: `README.md`
- Inspect: `tests/unit/deployment-config.test.ts`

- [ ] **Step 1: Confirm the public URL**

Use this exact deployment URL unless AirGradient ops assigns a different one:

```text
https://tools.airgradient.net/aq-time-tracker
```

- [ ] **Step 2: Confirm the Nginx upstream**

Ask AirGradient ops to confirm that the host Nginx route is:

```text
/aq-time-tracker -> http://aq-time-tracker:5500
```

Expected: the route path, Docker network alias, and port match `docker-compose.prod.yml`.

- [ ] **Step 3: Confirm the production server path**

Use this exact app directory because `deploy.sh` depends on it:

```text
/opt/apps/tracker
```

- [ ] **Step 4: Run the deployment config unit test locally**

Run:

```powershell
npm.cmd run test -- tests/unit/deployment-config.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Stop if AirGradient assigns a different path, alias, or port**

If ops assigns values other than `/aq-time-tracker`, `aq-time-tracker`, or `5500`, update these files together before deploying:

```text
Dockerfile
docker-compose.prod.yml
.env.example
README.md
tests/unit/deployment-config.test.ts
```

Then rerun:

```powershell
npm.cmd run test -- tests/unit/deployment-config.test.ts
npm.cmd run build
```

Expected: tests and build pass before deployment continues.

---

### Task 2: Get SSH And Git Access

**Files:**
- No repository file changes.

- [ ] **Step 1: Generate an SSH key if you do not already have one for AirGradient tools**

Run locally:

```bash
ssh-keygen -t ed25519 -C "airgradient-tools-access" -f "$HOME/.ssh/airgradient_tools_ed25519"
```

Expected: two files are created:

```text
$HOME/.ssh/airgradient_tools_ed25519
$HOME/.ssh/airgradient_tools_ed25519.pub
```

- [ ] **Step 2: Send only the public key**

Run locally:

```bash
cat "$HOME/.ssh/airgradient_tools_ed25519.pub"
```

Send the printed public key to AirGradient ops. Do not send the private key.

- [ ] **Step 3: Connect to the tools host from office network or VPN**

Run:

```bash
ssh -i "$HOME/.ssh/airgradient_tools_ed25519" root@tools.airgradient.net
```

Expected: shell prompt opens on the `tools` host.

- [ ] **Step 4: Confirm Git repository access**

On the tools host, run the Git clone or pull command using the repository URL that contains this source code.

Expected: the tools host can read the repository without interactive prompts, using either an SSH deploy key or a read-only access token.

---

### Task 3: Confirm Host Prerequisites

**Files:**
- No repository file changes.

- [ ] **Step 1: Confirm Docker and Compose**

On `tools.airgradient.net`, run:

```bash
docker --version
docker compose version
```

Expected: both commands print versions successfully.

- [ ] **Step 2: Confirm the shared Docker network**

Run:

```bash
docker network inspect app-network >/dev/null && echo "app-network exists"
```

Expected:

```text
app-network exists
```

- [ ] **Step 3: Confirm the apps directory**

Run:

```bash
ls -ld /opt/apps
```

Expected: `/opt/apps` exists and is writable by the deployment user.

- [ ] **Step 4: Confirm port availability**

Run:

```bash
docker ps --format '{{.Names}} {{.Ports}}' | grep ':5500->' || echo "port 5500 appears unused"
```

Expected:

```text
port 5500 appears unused
```

If another container already owns `5500`, stop and get a new assigned port from AirGradient ops.

---

### Task 4: Prepare The Server Checkout

**Files:**
- Server checkout path: `/opt/apps/tracker`
- Existing repo file used by cron: `deploy.sh`

- [ ] **Step 1: Clone or update the repository**

On `tools.airgradient.net`, run:

```bash
cd /opt/apps
```

If `/opt/apps/tracker` does not exist, clone the repository into that exact directory:

```bash
git clone <the-repository-read-url> tracker
```

If `/opt/apps/tracker` already exists, update it:

```bash
cd /opt/apps/tracker
git pull
```

Expected: the server checkout contains `deploy.sh`, `Dockerfile`, and `docker-compose.prod.yml`.

- [ ] **Step 2: Confirm the checkout path matches `deploy.sh`**

Run:

```bash
cd /opt/apps/tracker
test "$(pwd)" = "/opt/apps/tracker" && echo "deploy path ok"
```

Expected:

```text
deploy path ok
```

- [ ] **Step 3: Make the deploy script executable**

Run:

```bash
chmod +x deploy.sh
```

Expected: command exits successfully.

- [ ] **Step 4: Validate deploy script syntax**

Run:

```bash
bash -n deploy.sh
```

Expected: no output and exit code `0`.

---

### Task 5: Confirm The Server-Only Production Environment File

**Files:**
- Created on server only: `/opt/apps/tracker/.env.production`
- Do not commit: `.env.production`

- [ ] **Step 1: Let deploy bootstrap the environment**

The production Compose file starts PostgreSQL itself. `deploy.sh` creates `.env.production` with generated `POSTGRES_PASSWORD` and `NUXT_SESSION_PASSWORD` if the file is absent.

- [ ] **Step 2: Optionally pre-create `.env.production`**

Only do this if AirGradient wants to choose the database name, user, or secrets manually. Keep values URL-safe because the PostgreSQL password is used in `DATABASE_URL`.

Run:

```bash
cd /opt/apps/tracker
umask 077
nano .env.production
```

Use these keys:

```dotenv
POSTGRES_DB="ag_time_tracker"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="PASTE_A_LONG_URL_SAFE_SECRET_HERE"
NUXT_SESSION_PASSWORD="PASTE_A_LONG_SECRET_HERE"
NUXT_AI_INSIGHTS_API_KEY=""
PORT="5500"
NITRO_HOST="0.0.0.0"
NUXT_APP_BASE_URL="/aq-time-tracker/"
```

Expected: `.env.production` exists only on the server and is not committed. `deploy.sh` will add or repair `DATABASE_URL` so it points to `postgres:5432` inside Compose.

- [ ] **Step 4: Lock down permissions**

Run:

```bash
chmod 600 .env.production
```

Expected: only the owner can read and write `.env.production`.

- [ ] **Step 5: Confirm required keys exist without printing secrets**

Run:

```bash
grep -E '^(DATABASE_URL|POSTGRES_DB|POSTGRES_USER|POSTGRES_PASSWORD|NUXT_SESSION_PASSWORD|NUXT_AI_INSIGHTS_API_KEY|PORT|NITRO_HOST|NUXT_APP_BASE_URL)=' .env.production | cut -d= -f1
```

Expected:

```text
DATABASE_URL
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
NUXT_SESSION_PASSWORD
NUXT_AI_INSIGHTS_API_KEY
PORT
NITRO_HOST
NUXT_APP_BASE_URL
```

---

### Task 6: Validate Production Compose On The Host

**Files:**
- Inspect: `/opt/apps/tracker/docker-compose.prod.yml`
- Requires: `/opt/apps/tracker/.env.production`

- [ ] **Step 1: Render the Compose config**

Run:

```bash
cd /opt/apps/tracker
docker compose -f docker-compose.prod.yml --env-file .env.production config
```

Expected: Compose prints resolved YAML and includes:

```text
app-network
aq-time-tracker
aq-time-tracker-postgres
5500
```

- [ ] **Step 2: Build the production image**

Run:

```bash
IMAGE_TAG=verify docker compose -f docker-compose.prod.yml --env-file .env.production build web
```

Expected: image `ag-time-tracker:verify` builds successfully.

- [ ] **Step 3: Run migrations without starting the web app**

Run:

```bash
IMAGE_TAG=verify docker compose -f docker-compose.prod.yml --env-file .env.production --profile tools run --rm migrate
```

Expected: Prisma reports migrations applied or already in sync.

If this fails, do not start the app. Fix `.env.production`, the `postgres` service health, or migration state first.

---

### Task 7: Run The First Deployment

**Files:**
- Execute: `/opt/apps/tracker/deploy.sh`

- [ ] **Step 1: Force the first deployment**

Run:

```bash
cd /opt/apps/tracker
./deploy.sh --force
```

Expected output includes:

```text
Building production image
Running database migrations
Starting web container
Deployment completed successfully.
```

- [ ] **Step 2: Confirm the container is running**

Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Expected: service `web` is running.

- [ ] **Step 3: Check container logs**

Run:

```bash
docker logs --tail=100 aq-time-tracker
```

Expected: no fatal startup errors.

- [ ] **Step 4: Check the local health endpoint on the host**

Run:

```bash
curl -fsS http://127.0.0.1:5500/aq-time-tracker/api/health
```

Expected JSON contains:

```json
{"status":"ok","service":"ag-time-tracker"}
```

This health check verifies the app can reach PostgreSQL.

- [ ] **Step 5: Check the public route from office network or VPN**

Run from a machine that can access the tools host:

```bash
curl -I https://tools.airgradient.net/aq-time-tracker/
```

Expected: HTTP `200`, `301`, or `302` from the Nginx route. A `502` means Nginx cannot reach `http://aq-time-tracker:5500`.

---

### Task 8: Optional Demo Seed

**Files:**
- Execute only if approved for this environment: `backend/prisma/seed.mjs`

- [ ] **Step 1: Decide whether seeded demo users are allowed**

Use this only for an internal demo or integration environment. Do not seed real production data unless AirGradient explicitly approves it.

- [ ] **Step 2: Run the seed manually if approved**

Run:

```bash
cd /opt/apps/tracker
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm web npm run db:seed
```

Expected: the seed script finishes successfully.

- [ ] **Step 3: Verify demo login only in approved environments**

Open:

```text
https://tools.airgradient.net/aq-time-tracker/
```

Expected demo credentials only if seeded:

```text
Email: siri@airgradient.com
Password: demo
```

---

### Task 9: Configure Scheduler Or Cron

**Files:**
- Execute server command only.

- [ ] **Step 1: Add the scheduled deployment command**

Ask AirGradient ops to configure the scheduler to call:

```bash
cd /opt/apps/tracker && ./deploy.sh >> /var/log/aq-time-tracker-deploy.log 2>&1
```

Expected: the scheduler runs from the app directory and writes logs to `/var/log/aq-time-tracker-deploy.log`.

- [ ] **Step 2: Confirm the no-change path**

After a successful deploy, run:

```bash
cd /opt/apps/tracker
./deploy.sh
```

Expected output contains:

```text
No changes found and no new tags. Exiting
```

This confirms the script will not rebuild unnecessarily on every scheduler run.

---

### Task 10: Define The Update Process

**Files:**
- No repository file changes unless a deployment bug is found.

- [ ] **Step 1: Push source changes to the deployed branch**

Push changes to the branch checked out on the tools host.

Expected: the scheduler sees new commits on the next run.

- [ ] **Step 2: Trigger an immediate deploy when needed**

Run on the tools host:

```bash
cd /opt/apps/tracker
./deploy.sh
```

Expected: `git pull` fetches the new commit, then the script builds, migrates, and starts `web`.

- [ ] **Step 3: Force rebuild without source changes when needed**

Run:

```bash
cd /opt/apps/tracker
./deploy.sh --force
```

Expected: the script rebuilds and restarts even when Git is already up to date.

---

### Task 11: Rollback Procedure

**Files:**
- No repository file changes.

- [ ] **Step 1: List locally built image tags**

Run:

```bash
docker images ag-time-tracker
```

Expected: image tags include Git short SHAs created by `deploy.sh`.

- [ ] **Step 2: Restart a previous app image**

Replace `PREVIOUS_SHA` with a real tag printed by `docker images ag-time-tracker`, then run:

```bash
cd /opt/apps/tracker
IMAGE_TAG=PREVIOUS_SHA docker compose -f docker-compose.prod.yml --env-file .env.production up -d web
```

Expected: the `web` container restarts using the previous image tag.

- [ ] **Step 3: Recheck health after rollback**

Run:

```bash
curl -fsS http://127.0.0.1:5500/aq-time-tracker/api/health
```

Expected JSON contains:

```json
{"status":"ok","service":"ag-time-tracker"}
```

Database migrations are forward-only by default. For releases that change `backend/prisma/schema.prisma`, prepare a data-safe rollback plan before deploying.

---

## Final Deployment Checklist

- [ ] SSH access to `root@tools.airgradient.net` works from office network or VPN.
- [ ] `/opt/apps/tracker` is a real Git checkout.
- [ ] `deploy.sh` is executable and `bash -n deploy.sh` passes.
- [ ] `.env.production` exists on the server and is not committed.
- [ ] `DATABASE_URL` points to a reachable PostgreSQL database.
- [ ] `docker network inspect app-network` passes.
- [ ] Nginx route is `/aq-time-tracker -> http://aq-time-tracker:5500`.
- [ ] `docker compose -f docker-compose.prod.yml --env-file .env.production config` passes on the server.
- [ ] `./deploy.sh --force` completes successfully.
- [ ] `curl -fsS http://127.0.0.1:5500/aq-time-tracker/api/health` returns `status: ok`.
- [ ] `https://tools.airgradient.net/aq-time-tracker/` opens from office network or VPN.
- [ ] Scheduler calls `cd /opt/apps/tracker && ./deploy.sh`.

## Self-Review

- Spec coverage: The runbook keeps runtime persistence on PostgreSQL through Prisma, does not add billing/rate data, and keeps production behavior server-side.
- Placeholder scan: The only unknown values are secrets and the repository read URL, which must come from AirGradient ops and cannot be committed to the repository.
- Type and naming consistency: Public path `/aq-time-tracker`, Docker alias `aq-time-tracker`, container `aq-time-tracker`, app port `5500`, service `web`, image `ag-time-tracker`, and app directory `/opt/apps/tracker` are consistent with the current repository files.
