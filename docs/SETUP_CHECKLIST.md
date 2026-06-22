# Setup Checklist (First-Time Launch)

This is the **ordered, do-this-top-to-bottom** checklist for taking Komuta from an empty
server to a live production system. It lists **only the manual / human / secret** steps —
the things no script can do for you.

Legend:
- `[ ]` = a step to complete.
- **TODO(secret)** = produces or requires a secret value you must keep safe and put in `.env`.
- Each step links to the doc with full instructions.

> Tip: copy this file's checkboxes into an issue/ticket and tick them off as you go.

---

## A. Source control

- [ ] **Create the GitHub repository** (it is `alioanka/komuta`).
- [ ] Set the remote origin and push.
  > Development has happened on branch **`claude/upbeat-tesla-bmhqav`** — that branch is
  > already used; merge/rebase it into your default branch as appropriate.
  ```bash
  cd /path/to/komuta
  git remote add origin https://github.com/alioanka/komuta.git   # if not set
  git push -u origin HEAD
  ```
  📄 General reference; deploy uses this repo in
  [`02_DEPLOYMENT_CONTABO.md`](./02_DEPLOYMENT_CONTABO.md).

---

## B. Domain & DNS

- [ ] **Buy a domain** (suggested: `komuta.app` or `komutapanel.com`).
- [ ] **Create DNS records:** `A` for `@` and `www` (and `panel`) → VPS IPv4;
      `AAAA` only if the VPS has IPv6.
- [ ] Verify propagation with `dig +short komuta.app A`.
  📄 [`03_DOMAIN_AND_SSL.md`](./03_DOMAIN_AND_SSL.md)

---

## C. Provision & harden the VPS

- [ ] **Provision a Contabo VPS** (Ubuntu 22.04/24.04).
- [ ] Create a **sudo user** (`deploy`), set up **SSH key login**.
- [ ] **Disable root login and password auth** in SSH. **TODO(secret):** your SSH key.
- [ ] **ufw**: allow 22/80/443 only. Install **fail2ban** and **unattended-upgrades**.
- [ ] Install **Docker + Compose plugin**.
  📄 [`02_DEPLOYMENT_CONTABO.md`](./02_DEPLOYMENT_CONTABO.md) §1–2

---

## D. SSL / HTTPS

- [ ] Issue the **Let's Encrypt** cert via dockerized Certbot.
- [ ] Enable **HTTPS + HTTP→HTTPS redirect + HSTS** in Nginx.
- [ ] Set up **auto-renewal** and verify with `curl -I https://komuta.app`.
  📄 [`03_DOMAIN_AND_SSL.md`](./03_DOMAIN_AND_SSL.md)

---

## E. Meta / WhatsApp Cloud API

- [ ] Create a **Meta Business Portfolio** + **Developer account**.
- [ ] Create a **Business-type app**, add the **WhatsApp** product.
- [ ] **TODO(secret):** copy **App ID** → `META_APP_ID` and **App secret** → `META_APP_SECRET`.
- [ ] Add the **brand-new phone number** (no migration), **add a payment method**, set
      **display name**.
- [ ] **TODO(secret):** copy **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID` and
      **WABA ID** → `WHATSAPP_BUSINESS_ACCOUNT_ID`.
- [ ] Enable **two-step verification PIN** and **register** the number via
      `POST /{PHONE_NUMBER_ID}/register`. **TODO(secret):** the 6-digit PIN.
- [ ] Create a **System User**, assign the WABA with **Full control**, generate a
      **PERMANENT token** (scopes: `whatsapp_business_management`,
      `whatsapp_business_messaging`, `whatsapp_business_manage_events`).
      **TODO(secret):** → `WHATSAPP_ACCESS_TOKEN`.
- [ ] **TODO(secret):** choose a **verify token** → `META_VERIFY_TOKEN`.
- [ ] Configure **webhook**: callback `https://<domain>/webhooks/whatsapp`, the verify
      token, **subscribe to `messages`** (+ message status).
- [ ] Complete **Meta Business Verification** (documents; allow several days).
- [ ] Switch the app to **Live mode**; test inbound + outbound.
  📄 [`04_META_WHATSAPP_SETUP.md`](./04_META_WHATSAPP_SETUP.md)

---

## F. WhatsApp templates

- [ ] Create & submit (TR + EN, **Utility** category): `revenue_confirmation`,
      `missing_revenue_reminder`, `store_id_request`, `manager_confirmation`,
      `daily_summary`.
- [ ] After approval, map names into the **`MessageTemplate`** table.
  📄 [`05_WHATSAPP_TEMPLATES.md`](./05_WHATSAPP_TEMPLATES.md)

---

## G. Telegram alerts

- [ ] Create a bot via **@BotFather**. **TODO(secret):** token → `TELEGRAM_BOT_TOKEN`.
- [ ] Find the chat id via `getUpdates`. **TODO(secret):** → `TELEGRAM_DEFAULT_CHAT_ID`.
- [ ] Send a test `sendMessage`.
  📄 [`06_TELEGRAM_ALERTS.md`](./06_TELEGRAM_ALERTS.md)

---

## H. Fill in `.env`

- [ ] On the VPS, `cp .env.example .env` and fill **every** value. **TODO(secret)** for:
  - [ ] `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (`openssl rand -base64 48` each).
  - [ ] `META_APP_SECRET`, `META_VERIFY_TOKEN`.
  - [ ] `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_ACCESS_TOKEN`.
  - [ ] `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DEFAULT_CHAT_ID`.
  - [ ] `BACKUP_ENCRYPTION_KEY` (`openssl rand -base64 32`).
  - [ ] `SEED_OWNER_*`, `SEED_ACCOUNTANT_*` (set; change passwords after first login).
- [ ] Set production URLs/CORS/cookie domain (`APP_URL`, `API_URL`, `CORS_ORIGIN`,
      `COOKIE_DOMAIN`) and `NODE_ENV=production`.
- [ ] `chmod 600 .env`.
  📄 [`.env.example`](../.env.example), [`02_DEPLOYMENT_CONTABO.md`](./02_DEPLOYMENT_CONTABO.md) §3

---

## I. First deploy

- [ ] `docker compose up -d --build`.
- [ ] `docker compose exec api pnpm db:deploy` (migrations).
- [ ] `docker compose exec api pnpm db:seed` (**once**).
- [ ] Verify health: `curl -I https://komuta.app/api/health`.
  📄 [`02_DEPLOYMENT_CONTABO.md`](./02_DEPLOYMENT_CONTABO.md) §4–7

---

## J. First login & secure it

- [ ] Log in at `https://komuta.app` as the seeded **owner**.
- [ ] **Immediately change** the seeded passwords (the `SEED_OWNER_*` /
      `SEED_ACCOUNTANT_*` accounts). **TODO(secret).**
- [ ] Confirm the owner sees the dashboard; confirm the accountant can log in.
  📄 [`07_USER_GUIDE_TR.md`](./07_USER_GUIDE_TR.md)

---

## K. Post-launch hardening

- [ ] Schedule **nightly encrypted backups** (cron/systemd) and store
      `BACKUP_ENCRYPTION_KEY` **off** the server.
- [ ] Configure an **offsite** backup copy and run a **test restore**.
- [ ] Confirm **Telegram alerts** fire (e.g. trigger a "no messages" condition).
  📄 [`09_BACKUP_RESTORE.md`](./09_BACKUP_RESTORE.md), [`08_OPERATIONS_RUNBOOK.md`](./08_OPERATIONS_RUNBOOK.md)

---

### Secrets summary (everything marked TODO(secret))

Keep these in a password manager, **not** in git:

| Secret                         | Source                          |
|--------------------------------|---------------------------------|
| SSH private key                | your laptop (`ssh-keygen`)      |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `openssl rand -base64 48` |
| `META_APP_SECRET`              | Meta App Settings → Basic       |
| `META_VERIFY_TOKEN`            | you invent it                   |
| `WHATSAPP_PHONE_NUMBER_ID`     | WhatsApp API Setup              |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp API Setup              |
| WhatsApp two-step PIN          | you choose it                   |
| `WHATSAPP_ACCESS_TOKEN`        | System User permanent token     |
| `TELEGRAM_BOT_TOKEN`           | @BotFather                      |
| `TELEGRAM_DEFAULT_CHAT_ID`     | `getUpdates`                     |
| `BACKUP_ENCRYPTION_KEY`        | `openssl rand -base64 32`       |
| Seeded owner/accountant passwords | `.env` SEED_* (change after login) |
