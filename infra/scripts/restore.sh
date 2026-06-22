#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Komuta — restore an encrypted PostgreSQL backup.
#
# Decrypts a .sql.enc file produced by backup.sh and pipes it into psql in the
# running `postgres` container. THIS OVERWRITES the current database, so it
# asks for confirmation first.
#
# Usage:
#   ./infra/scripts/restore.sh ./backups/komuta-20260622-030000.sql.enc
# ----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <path-to-backup.sql.enc>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

# --- Load configuration from .env -------------------------------------------
if [ ! -f .env ]; then
  echo "ERROR: .env not found in $REPO_ROOT" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY is not set in .env" >&2
  exit 1
fi

PGUSER="${POSTGRES_USER:-komuta}"
PGDATABASE="${POSTGRES_DB:-komuta}"

# --- Confirmation -----------------------------------------------------------
echo "WARNING: this will restore '$BACKUP_FILE' INTO database '$PGDATABASE'."
echo "         Existing data may be overwritten."
read -r -p "Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "==> Decrypting and restoring into $PGDATABASE"
# openssl decrypt on the host -> psql inside the container. pipefail catches
# a bad key / corrupt file (openssl fails -> pipeline fails).
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_ENCRYPTION_KEY -in "$BACKUP_FILE" \
  | docker compose exec -T postgres psql -U "$PGUSER" -d "$PGDATABASE"

echo "==> Restore complete"
