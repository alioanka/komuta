# Backup & Restore

Komuta's system of record is **PostgreSQL**. Losing it means losing all revenue history,
so backups are non-negotiable. This doc describes how to **use** the backup/restore
scripts in `infra/scripts/` (the scripts themselves are maintained by another engineer),
how to schedule them, and how to keep an **offsite** copy.

> Backups are **encrypted at rest** with OpenSSL using the `BACKUP_ENCRYPTION_KEY` from
> `.env`. Without that key, a stolen backup file is useless — and so is a backup you can
> no longer decrypt, so **store the key safely and separately**.

---

## 1. `infra/scripts/backup.sh` — what it does

`backup.sh` performs an **encrypted `pg_dump`**:

1. Runs `pg_dump` against the Postgres container (using `DATABASE_URL`).
2. Pipes the dump through **`openssl`** symmetric encryption, keyed by
   **`BACKUP_ENCRYPTION_KEY`**, producing a file like
   `komuta-YYYYMMDD-HHMMSS.sql.enc`.
3. Writes it to the backups directory (e.g. `/opt/komuta/backups/`).
4. Applies **retention**: deletes encrypted backups older than the configured number of
   days (e.g. keep 14 days).

### Run a backup manually

```bash
cd /opt/komuta
./infra/scripts/backup.sh
```

Confirm a file was produced:

```bash
ls -lh /opt/komuta/backups/
```

> The exact dump command inside the script is conceptually:
> ```bash
> docker compose exec -T postgres pg_dump "$DATABASE_URL" \
>   | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"$BACKUP_ENCRYPTION_KEY" \
>   > "backups/komuta-$(date +%Y%m%d-%H%M%S).sql.enc"
> ```
> Read `backup.sh` to see the precise flags your engineer used (the `openssl` decrypt in
> §3 must match the encrypt flags here).

---

## 2. Schedule it (cron)

Run nightly at **03:30 server time**. Edit the crontab of the `deploy` user:

```bash
crontab -e
```

Add:

```cron
# Komuta encrypted nightly DB backup at 03:30, log to file
30 3 * * * cd /opt/komuta && ./infra/scripts/backup.sh >> /opt/komuta/backups/backup.log 2>&1
```

Verify the cron entry:

```bash
crontab -l
```

Check the log after the first scheduled run:

```bash
tail -n 50 /opt/komuta/backups/backup.log
```

> If your project ships a **systemd timer** instead (`infra/systemd/`), enable that
> instead of cron:
> ```bash
> sudo systemctl enable --now komuta-backup.timer
> systemctl list-timers | grep komuta
> ```

---

## 3. `infra/scripts/restore.sh` — restoring

`restore.sh` reverses the process: it **decrypts** a chosen `.sql.enc` file with
`BACKUP_ENCRYPTION_KEY` and **loads** it back into Postgres.

### Restore from a backup

```bash
cd /opt/komuta
./infra/scripts/restore.sh /opt/komuta/backups/komuta-20260622-033000.sql.enc
```

> Conceptually it does:
> ```bash
> openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"$BACKUP_ENCRYPTION_KEY" \
>   -in "$1" \
>   | docker compose exec -T postgres psql "$DATABASE_URL"
> ```

> **Restore is destructive.** It overwrites current data. Before restoring in production,
> take a fresh backup first, and consider stopping the api/worker so nothing writes mid-restore:
> ```bash
> docker compose stop api worker
> ./infra/scripts/restore.sh <file>
> docker compose start api worker
> ```

### Test your restore (do this regularly!)

A backup you've never restored is not a backup. Periodically prove it works against a
**throwaway** database/container — never test-restore over production. Suggested drill:

1. Spin up a temporary Postgres (or use the dev compose locally).
2. Point a copy of `restore.sh`/`DATABASE_URL` at it.
3. Decrypt + load a recent backup.
4. Confirm row counts / latest revenue date look right.

---

## 4. Offsite copy (3-2-1 rule)

Backups on the same VPS die with the VPS. Keep at least one copy **off the server**.

Options:

- **`rclone`** to S3-compatible storage (Backblaze B2, Wasabi, Cloudflare R2, etc.):

  ```bash
  # one-time: rclone config  → create a remote named e.g. "offsite"
  rclone copy /opt/komuta/backups offsite:komuta-backups \
    --include "*.sql.enc" --max-age 2d
  ```

  Add it to the same nightly cron, **after** the backup step:

  ```cron
  45 3 * * * rclone copy /opt/komuta/backups offsite:komuta-backups --include "*.sql.enc" --max-age 2d >> /opt/komuta/backups/offsite.log 2>&1
  ```

- **`scp`/`rsync`** to another machine you control:

  ```bash
  rsync -avz /opt/komuta/backups/*.sql.enc backupuser@backup-host:/srv/komuta-backups/
  ```

> Because files are already encrypted with `BACKUP_ENCRYPTION_KEY`, they're safe to store
> on third-party cloud storage. **Keep the encryption key somewhere other than the
> backups** (e.g. a password manager) — if both are lost together, recovery is impossible.

---

## 5. Backup health checklist

- [ ] `backup.sh` runs nightly via cron/systemd and writes a new `.sql.enc`.
- [ ] Retention prunes old files (disk doesn't fill up — check `df -h /`).
- [ ] At least one **offsite** copy exists and is recent.
- [ ] A **test restore** has been performed successfully in the last ~3 months.
- [ ] `BACKUP_ENCRYPTION_KEY` is stored safely **off** the server.
