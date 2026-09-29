# Production Migration, Backup, And Recovery Runbook

This runbook is preparation for a future AirGradient internal deployment. It is not approval to deploy. Run production commands only during an approved maintenance window, from the tools host, with an identified operator and rollback owner.

The current production contract is:

- checkout: `/opt/apps/tracker`
- Compose file: `docker-compose.prod.yml`
- environment file: `.env.production` with mode `600`
- protected backup directory: `/var/backups/ag-time-tracker` with mode `700`, owned by the deployment operator and outside the Git checkout
- application container: `aq-time-tracker`
- PostgreSQL container: `aq-time-tracker-postgres`
- application image: `ag-time-tracker:<git-short-sha>`
- host health URL: `http://127.0.0.1:5500/tracker/api/health`
- public base URL: `https://tools.airgradient.net/tracker/`

Never enable shell tracing (`set -x`) while `.env.production` is loaded. Do not paste the environment file, database URL, password, session secret, or backup contents into logs, tickets, or chat.

## 1. Preconditions And Change Record

Connect to the tools host and start in the production checkout:

```bash
cd /opt/apps/tracker
test -f .env.production
test "$(stat -c '%a' .env.production)" = "600"
test -z "$(git status --porcelain)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ag-time-tracker}"
export BACKUP_DIR
test -d "$BACKUP_DIR"
test "$(stat -c '%a' "$BACKUP_DIR")" = "700"
./scripts/production-backup.sh --dry-run >/dev/null
npm run verify:production
docker network inspect app-network >/dev/null
docker compose -f docker-compose.prod.yml --env-file .env.production config --quiet
```

Stop if any command fails. Record the candidate and currently running image before changing anything:

```bash
git pull --ff-only
CANDIDATE_SHA="$(git rev-parse HEAD)"
CANDIDATE_TAG="${CANDIDATE_SHA:0:12}"
PREVIOUS_IMAGE="$(docker inspect --format '{{.Config.Image}}' aq-time-tracker 2>/dev/null || true)"
printf 'Candidate SHA: %s\nPrevious image: %s\n' "$CANDIDATE_SHA" "${PREVIOUS_IMAGE:-first deployment}"
```

Keep `PREVIOUS_IMAGE` in the private change record. It contains no secret, but it is required for application rollback.

## 2. Start PostgreSQL And Take A Pre-Migration Backup

Bring up only PostgreSQL and wait for it to become healthy:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres
docker compose -f docker-compose.prod.yml --env-file .env.production ps postgres
```

The platform owner must provision `/var/backups/ag-time-tracker` (or the
approved absolute `BACKUP_DIR`) outside `/opt/apps/tracker`, owned by the
deployment operator with mode `700`. Do not use an in-checkout directory. The
backup helper canonicalizes both paths and refuses an in-checkout or
group/world-accessible destination before any database command. It then streams
a custom-format logical backup from PostgreSQL, validates it with `pg_restore`,
writes a SHA-256 checksum, and leaves both files at mode `600`. This happens
before any migration command.

```bash
umask 077
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ag-time-tracker}"
export BACKUP_DIR
./scripts/production-backup.sh --dry-run
BACKUP_FILE="$(./scripts/production-backup.sh)"
export BACKUP_FILE
test -s "$BACKUP_FILE"
sha256sum --check "$BACKUP_FILE.sha256"
test "$(stat -c '%a' "$BACKUP_FILE")" = "600"
test "$(stat -c '%a' "$BACKUP_FILE.sha256")" = "600"
test -z "$(git status --porcelain)"
```

Copy the dump and checksum to the approved encrypted off-host backup location
before continuing. A file that exists only on the same host and Docker volume
is not sufficient recovery protection. `/backups/` is ignored only as defense
in depth; production backup files must never be written inside the repository.

## 3. Build The Candidate And Check Migration Status

Build the exact candidate SHA, then run the read-only Prisma migration status command against production PostgreSQL:

```bash
IMAGE_TAG="$CANDIDATE_TAG" \
  docker compose -f docker-compose.prod.yml --env-file .env.production build web

IMAGE_TAG="$CANDIDATE_TAG" \
  docker compose -f docker-compose.prod.yml --env-file .env.production --profile tools \
  run --rm migrate npx prisma migrate status --schema=backend/prisma/schema.prisma
```

Review every pending migration against the release. Stop if Prisma reports a failed or divergent migration, an unexpected pending migration, or an inaccessible database.

## 4. Deploy

Only continue after the backup, checksum, off-host copy, candidate build, and migration review are complete:

```bash
cd /opt/apps/tracker
test "$(git rev-parse HEAD)" = "$CANDIDATE_SHA"
./deploy.sh --force --no-pull --expected-sha "$CANDIDATE_SHA"
```

The script refuses a missing or changed reviewed SHA, performs no second pull in this runbook flow, verifies production configuration, builds the immutable candidate, rechecks the SHA before migration and startup, runs `prisma migrate deploy`, and starts the web service in that order. Do not start the web service manually if migration fails.

## 5. Health And Logs

Check service state and recent logs without printing environment variables:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker logs --tail=200 aq-time-tracker
docker logs --tail=200 aq-time-tracker-postgres
```

Verify the database-backed health endpoint locally:

```bash
curl -fsS http://127.0.0.1:5500/tracker/api/health
```

Expected shape:

```json
{"status":"ok","service":"ag-time-tracker","checkedAt":"<ISO-8601 timestamp>"}
```

From an office-network or VPN client, verify the public route:

```bash
curl -fsS https://tools.airgradient.net/tracker/api/health
curl -I https://tools.airgradient.net/tracker/
```

Stop the rollout if health fails, the web container restarts repeatedly, PostgreSQL is unhealthy, or fatal errors appear in either log.

## 6. Application Image Rollback

Application rollback does not reverse Prisma migrations. Use it only when the previous application image is compatible with the current database schema.

List available images and derive the previous tag recorded before deployment:

```bash
docker images ag-time-tracker --format 'table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}'
PREVIOUS_TAG="${PREVIOUS_IMAGE#ag-time-tracker:}"
test -n "$PREVIOUS_TAG"
```

Restart only the web service with the previous image. Do not run the migration service during an image rollback:

```bash
IMAGE_TAG="$PREVIOUS_TAG" \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  up -d --no-build web

curl -fsS http://127.0.0.1:5500/tracker/api/health
docker logs --tail=200 aq-time-tracker
```

If the previous image is not compatible with the migrated schema, stop and use the isolated database restore procedure below.

## 7. Restore Into A New Database

Never restore over the production database. Create a new database in the same PostgreSQL server, restore the selected dump there, inspect it, and only then decide whether to repoint the application.

Choose the verified backup and create a unique database name:

```bash
cd /opt/apps/tracker
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ag-time-tracker}"
BACKUP_FILE="$BACKUP_DIR/ag_time_tracker_pre_migration_YYYYMMDDTHHMMSSZ.dump"
RESTORE_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RESTORE_DB="ag_time_tracker_restore_${RESTORE_STAMP}"
test -s "$BACKUP_FILE"
sha256sum --check "$BACKUP_FILE.sha256"
```

Create and restore the isolated database:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres sh -ceu \
  'createdb --username="$POSTGRES_USER" "$1"' sh "$RESTORE_DB"

docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres sh -ceu \
  'exec pg_restore --exit-on-error --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$1"' \
  sh "$RESTORE_DB" < "$BACKUP_FILE"

docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres sh -ceu \
  'psql --username="$POSTGRES_USER" --dbname="$1" --command="\\dt"' sh "$RESTORE_DB"
```

Check Prisma migration status against the restored database without printing its URL. The generated production password is URL-safe hexadecimal; if operations has replaced it with another format, URL-encode it before constructing the URL.

```bash
set +x
set -a
. ./.env.production
set +a
RESTORE_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${RESTORE_DB}?schema=public"

IMAGE_TAG="$PREVIOUS_TAG" \
  docker compose -f docker-compose.prod.yml --env-file .env.production --profile tools \
  run --rm -e DATABASE_URL="$RESTORE_DATABASE_URL" migrate \
  npx prisma migrate status --schema=backend/prisma/schema.prisma

unset RESTORE_DATABASE_URL POSTGRES_PASSWORD NUXT_SESSION_PASSWORD DATABASE_URL
```

Before repointing the application, inspect expected table counts and a sample of non-sensitive records using approved operational queries. Do not export raw user data into the change log.

## 8. Repoint To The Restored Database

This is a separate, explicit recovery decision. Preserve the current environment file first:

```bash
umask 077
cp .env.production ".env.production.before_restore_${RESTORE_STAMP}"
cp .env.production .env.restore
chmod 600 ".env.production.before_restore_${RESTORE_STAMP}" .env.restore
```

Using a secure editor, change both of these entries in `.env.restore` without printing their values:

```text
POSTGRES_DB="<RESTORE_DB>"
DATABASE_URL="postgresql://<same-user>:<same-password>@postgres:5432/<RESTORE_DB>?schema=public"
```

Confirm only the database name, then start the chosen compatible image against the restored database:

```bash
grep '^POSTGRES_DB=' .env.restore

IMAGE_TAG="$PREVIOUS_TAG" \
  docker compose -f docker-compose.prod.yml --env-file .env.restore \
  up -d --no-build web

curl -fsS http://127.0.0.1:5500/tracker/api/health
docker logs --tail=200 aq-time-tracker
```

After application-level validation and explicit approval, promote the recovery environment so the next scheduled deployment does not switch back to the old database:

```bash
cp .env.restore .env.production
chmod 600 .env.production
```

Keep the original database and its pre-migration backup unchanged until the recovery owner closes the incident.

## 9. Stop Conditions

Stop and escalate instead of improvising when:

- the pre-migration backup or checksum cannot be verified;
- the backup has not reached approved off-host encrypted storage;
- Prisma reports failed, divergent, or unexpected migrations;
- the candidate SHA changes after backup/review;
- migration or health checks fail;
- the previous image is incompatible with the migrated schema;
- restore validation produces missing tables or unexpected row counts;
- the operator cannot identify the intended image tag, backup file, or target database.

Prisma migrations are forward-only in this project. Never edit a shared migration and never attempt an ad-hoc down migration during an incident.
