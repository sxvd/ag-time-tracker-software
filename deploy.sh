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
