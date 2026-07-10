#!/bin/bash

echo "Deployment started at $(date)"

set -euo pipefail

APP_DIR="/opt/apps/tracker"
ENV_FILE=".env.production"
FORCE=false
ENV_CHANGED=false

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -f|--force) FORCE=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

echo "Navigating to $APP_DIR"
cd "$APP_DIR"

generate_hex_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  dd if=/dev/urandom bs=32 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n'
}

get_env_value() {
  local key="$1"
  local line

  line=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -n 1 || true)
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"

  printf "%s" "$line"
}

set_env_value() {
  local key="$1"
  local value="$2"
  local tmp

  tmp=$(mktemp)
  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^" key "=" {
      print key "=\"" value "\""
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=\"" value "\""
      }
    }
  ' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm "$tmp"
  ENV_CHANGED=true
}

ensure_env_key() {
  local key="$1"
  local value="$2"

  if ! grep -Eq "^${key}=" "$ENV_FILE"; then
    set_env_value "$key" "$value"
  fi
}

ensure_env_secret() {
  local key="$1"

  if [[ -z "$(get_env_value "$key")" ]]; then
    set_env_value "$key" "$(generate_hex_secret)"
  fi
}

echo "Checking production environment"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Creating .env.production"
  umask 077
  : > "$ENV_FILE"
  ENV_CHANGED=true
else
  echo ".env.production already exists"
fi

ensure_env_key "POSTGRES_DB" "ag_time_tracker"
ensure_env_key "POSTGRES_USER" "postgres"
ensure_env_secret "POSTGRES_PASSWORD"
ensure_env_secret "NUXT_SESSION_PASSWORD"
ensure_env_key "NUXT_AI_INSIGHTS_API_KEY" ""
ensure_env_key "PORT" "5500"
ensure_env_key "NITRO_HOST" "0.0.0.0"
ensure_env_key "NUXT_APP_BASE_URL" "/aq-time-tracker/"

DB_NAME=$(get_env_value "POSTGRES_DB")
DB_USER=$(get_env_value "POSTGRES_USER")
DB_PASSWORD=$(get_env_value "POSTGRES_PASSWORD")
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}?schema=public"
CURRENT_DATABASE_URL=$(get_env_value "DATABASE_URL")

if [[ -z "$CURRENT_DATABASE_URL" || "$CURRENT_DATABASE_URL" == *"@localhost:5432/"* || "$CURRENT_DATABASE_URL" == *"@127.0.0.1:5432/"* ]]; then
  echo "Configuring DATABASE_URL for Compose PostgreSQL"
  set_env_value "DATABASE_URL" "$DATABASE_URL"
fi

chmod 600 "$ENV_FILE"

echo "Pulling latest changes"
PULL_OUTPUT=$(git pull 2>&1)
echo "$PULL_OUTPUT"

if [[ "$PULL_OUTPUT" == *"Already up to date."* && "$PULL_OUTPUT" != *"[new tag]"* && "$FORCE" == false && "$ENV_CHANGED" == false ]]; then
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
