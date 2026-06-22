# Operations Runbook (Day-2 Ops)

This is the **operator's** reference for running Komuta in production after it's deployed.
It assumes the stack is up via Docker Compose on the Contabo VPS (see
[`02_DEPLOYMENT_CONTABO.md`](./02_DEPLOYMENT_CONTABO.md)).

All commands run from the repo directory on the VPS:

```bash
cd /opt/komuta
```

---

## 1. Viewing logs

```bash
docker compose logs -f                 # all services, follow
docker compose logs -f api             # API (webhook, REST, SSE)
docker compose logs -f worker          # message-processing pipeline
docker compose logs -f web             # Next.js
docker compose logs --tail=300 api     # last 300 lines
docker compose logs --since=30m worker # last 30 minutes
```

Filter for errors quickly:

```bash
docker compose logs --since=1h api worker | grep -iE "error|warn|fail"
```

---

## 2. Restarts

```bash
docker compose restart api             # restart one service
docker compose restart api worker      # restart several
docker compose restart                 # restart everything (brief downtime)
```

Recreate a service from its image (after `.env` changes):

```bash
docker compose up -d api worker        # re-applies env, no rebuild
```

Full rebuild (after code update):

```bash
docker compose up -d --build
```

Check health any time:

```bash
docker compose ps
curl -I https://komuta.app/api/health
```

---

## 3. Rotating the WhatsApp access token

Rotate `WHATSAPP_ACCESS_TOKEN` if it leaks, on a schedule, or when an admin leaves.

1. In **Business Settings → System Users**, select the `komuta-server` system user.
2. (Optional, if compromised) **revoke** the existing token.
3. **Generate new token** with the **same scopes**:
   `whatsapp_business_management`, `whatsapp_business_messaging`,
   `whatsapp_business_manage_events`, expiration **Never**. Copy it.
4. Update `.env` on the VPS:

   ```bash
   nano /opt/komuta/.env     # set WHATSAPP_ACCESS_TOKEN=<new token>
   ```

5. Apply without a full rebuild:

   ```bash
   docker compose up -d api worker
   ```

6. Verify it works:

   ```bash
   curl -s "https://graph.facebook.com/v23.0/<WHATSAPP_PHONE_NUMBER_ID>?fields=verified_name" \
     -H "Authorization: Bearer <new token>"
   ```

> The same rotation idea applies to `META_APP_SECRET` (App Settings → Basic → Reset),
> `JWT_*` secrets (rotating these logs everyone out), and `BACKUP_ENCRYPTION_KEY`
> (rotating it means old backups need the old key — keep both until old backups expire).

---

## 4. Scaling the worker

The worker is stateless and pulls jobs from Redis, so you can run **multiple replicas**
to process more messages in parallel.

```bash
docker compose up -d --scale worker=3
```

Confirm:

```bash
docker compose ps worker
```

BullMQ distributes jobs across replicas automatically. Scale back down with
`--scale worker=1`. (For very high volume, also watch Redis memory and Postgres
connection count.)

> If your compose file pins `container_name` on the worker, remove it first — named
> containers can't be scaled.

---

## 5. When messages aren't arriving

Work through this checklist in order.

### 5.1 Is the webhook still subscribed?

- In the Meta app dashboard → **WhatsApp → Configuration**, confirm:
  - Callback URL is `https://komuta.app/webhooks/whatsapp`.
  - The **`messages`** field is **subscribed**.
  - The app is in **Live** mode.
- Test reachability:

  ```bash
  curl -I https://komuta.app/webhooks/whatsapp
  curl -s "https://komuta.app/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<META_VERIFY_TOKEN>&hub.challenge=ping"
  # should echo: ping
  ```

### 5.2 Are POSTs arriving but being rejected (signature)?

Look for signature-rejection logs:

```bash
docker compose logs --since=1h api | grep -iE "signature|x-hub|401|403"
```

If you see signature mismatches, `META_APP_SECRET` in `.env` is wrong or stale. Fix it
and `docker compose up -d api`.

### 5.3 Is the queue healthy?

- Check Redis is up:

  ```bash
  docker compose exec redis redis-cli ping     # → PONG
  ```

- Check the worker is consuming (no growing backlog):

  ```bash
  docker compose logs -f worker
  ```

- If the worker is crashing on startup, fix the error shown, then `docker compose up -d worker`.

### 5.4 Is HTTPS/Nginx healthy?

```bash
docker compose exec nginx nginx -t
curl -I https://komuta.app/api/health
```

A failed cert or Nginx misconfig will stop Meta from delivering — Meta requires a valid
HTTPS endpoint. See [`03_DOMAIN_AND_SSL.md`](./03_DOMAIN_AND_SSL.md).

### 5.5 Telegram alert

If you've configured Telegram alerts, a "no inbound messages in N minutes" alert is your
early warning. Make sure `TELEGRAM_BOT_TOKEN` / `TELEGRAM_DEFAULT_CHAT_ID` are set
([`06_TELEGRAM_ALERTS.md`](./06_TELEGRAM_ALERTS.md)).

---

## 6. Re-processing a stuck or failed message

A message can fail processing (e.g. an unrecognized format, or a transient DB error). It
lands in the BullMQ **failed** set.

### Re-deliver from Meta (simplest)

Ask the sender to resend, **or** replay the exact webhook payload from your logs against
the webhook (use a **new** `wamid` if Komuta dedupes by id; otherwise reuse to test
idempotency):

```bash
curl -s -X POST https://komuta.app/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: <recomputed signature>" \
  --data @one-message.json
```

(See [`01_LOCAL_DEVELOPMENT.md`](./01_LOCAL_DEVELOPMENT.md) §9 for building the payload
and signature.)

### Retry the failed BullMQ job

If Komuta exposes an admin/queue action, use it to **retry** failed jobs. Otherwise, the
worker's retry policy will re-attempt with backoff. Inspect failures via logs:

```bash
docker compose logs --since=2h worker | grep -iE "failed|retry|stuck"
```

> **Idempotency safety net:** Komuta dedupes by WhatsApp **message id**, so re-delivering
> the same message will not create a duplicate revenue record — it's safe to replay.

---

## 7. Routine health snapshot (paste-and-run)

```bash
cd /opt/komuta
echo "== containers =="; docker compose ps
echo "== api health =="; curl -fsS https://komuta.app/api/health && echo OK
echo "== redis =="; docker compose exec -T redis redis-cli ping
echo "== recent errors =="; docker compose logs --since=15m api worker | grep -iE "error|fail" | tail -n 20
echo "== disk =="; df -h /
```

For backups and restores, see [`09_BACKUP_RESTORE.md`](./09_BACKUP_RESTORE.md).
