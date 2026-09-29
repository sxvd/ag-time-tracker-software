#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd -P)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ag-time-tracker}"
DRY_RUN=false

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown parameter: $1" >&2; exit 1 ;;
  esac
  shift
done

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory must already exist with mode 700: $BACKUP_DIR" >&2
  exit 1
fi

GIT_ROOT="$(git -C "$APP_DIR" rev-parse --show-toplevel)"
GIT_ROOT="$(cd "$GIT_ROOT" && pwd -P)"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd -P)"

case "$BACKUP_DIR/" in
  "$GIT_ROOT/"*)
    echo "Backup directory must be outside the Git checkout: $GIT_ROOT" >&2
    exit 1
    ;;
esac

BACKUP_MODE="$(node -e 'process.stdout.write(((require("node:fs").statSync(process.argv[1]).mode & 0o777).toString(8)))' "$BACKUP_DIR")"
if [[ "$BACKUP_MODE" != "700" ]]; then
  echo "Backup directory must have mode 700; found $BACKUP_MODE: $BACKUP_DIR" >&2
  exit 1
fi

BACKUP_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/ag_time_tracker_pre_migration_${BACKUP_STAMP}.dump"

if [[ "$DRY_RUN" == true ]]; then
  printf '%s\n' "$BACKUP_FILE"
  exit 0
fi

umask 077
PARTIAL_FILE="$BACKUP_FILE.partial"
trap 'rm -f "$PARTIAL_FILE"' EXIT

cd "$APP_DIR"
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres sh -ceu \
  'exec pg_dump --format=custom --no-owner --no-privileges --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  > "$PARTIAL_FILE"

test -s "$PARTIAL_FILE"
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T postgres pg_restore --list < "$PARTIAL_FILE" >/dev/null

mv "$PARTIAL_FILE" "$BACKUP_FILE"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
else
  echo "A SHA-256 checksum tool is required (sha256sum or shasum)." >&2
  exit 1
fi
chmod 600 "$BACKUP_FILE" "$BACKUP_FILE.sha256"
trap - EXIT

printf '%s\n' "$BACKUP_FILE"
