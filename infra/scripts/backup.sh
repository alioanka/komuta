#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Komuta — encrypted PostgreSQL backup.
#
# Dumps the database from the running `postgres` container and streams it
# through AES-256-CBC encryption to a timestamped file under ./backups.
# Backups older than the retention window are deleted.
#
# Decrypt later with infra/scripts/restore.sh.
#
# Requires BACKUP_ENCRYPTION_KEY (and DB creds) in .env.
# Suitable for cron, e.g. nightly:
#   0 3 * * *  /home/user/komuta/infra/scripts/backup.sh >> /var/log/komuta-backup.log 2>&1
# ----------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# --- Load configuration from .env -------------------------------------------
if [ ! -f .env ]; then
  echo "ERROR: .env not found in $REPO_ROOT" >&2
  exit 1
fi
# Export every var defined in .env into the environment.
set -a
# shellcheck disable=SC1091
. ./.env
set +a

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY is not set in .env" >&2
  exit 1
fi

# Derive DB connection details. Prefer explicit POSTGRES_* vars, fall back to
# the defaults baked into .env.example / docker-compose.yml.
PGUSER="${POSTGRES_USER:-komuta}"
PGDATABASE="${POSTGRES_DB:-komuta}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_DIR="$REPO_ROOT/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUTFILE="$BACKUP_DIR/komuta-${TIMESTAMP}.sql.enc"

echo "==> Dumping $PGDATABASE and encrypting to $OUTFILE"
# pg_dump in the container -> openssl on the host. `set -o pipefail` (above)
# makes the pipeline fail if pg_dump fails.
docker compose exec -T postgres pg_dump -U "$PGUSER" -d "$PGDATABASE" \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_ENCRYPTION_KEY \
  > "$OUTFILE"

echo "==> Backup written: $(du -h "$OUTFILE" | cut -f1)  $OUTFILE"

echo "==> Pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name 'komuta-*.sql.enc' -type f -mtime +"$RETENTION_DAYS" -print -delete

echo "==> Backup complete"
