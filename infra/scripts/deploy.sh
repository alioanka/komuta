#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Komuta — deploy / update the production stack.
#
# Pulls the latest code, rebuilds images, restarts services, applies pending
# Prisma migrations, prunes dangling images, and prints status.
#
# Run from anywhere; it cd's to the repo root. Intended for the VPS.
#   ./infra/scripts/deploy.sh
# ----------------------------------------------------------------------------
set -euo pipefail

# Resolve repo root relative to this script so cron/systemd can call it.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building images"
docker compose build

echo "==> Starting / updating services"
docker compose up -d

echo "==> Waiting for the api container to be up before migrating"
# Give the api a moment to become healthy before running migrations against it.
sleep 5

echo "==> Applying database migrations"
docker compose exec -T api npx --yes prisma@5.22.0 migrate deploy --schema prisma/schema.prisma

# Nginx resolves upstream container IPs once at startup; recreated api/web
# containers get new IPs, leaving nginx proxying to dead ones (502s).
echo "==> Restarting nginx to pick up new upstream container IPs"
docker compose restart nginx

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Current status"
docker compose ps

echo "==> Deploy complete"
