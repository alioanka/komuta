# Local Development

This guide gets Komuta running **on your own laptop** so you can develop and test
without touching the production server. No prior knowledge of NestJS, Next.js, or
BullMQ is assumed — follow the steps in order and copy-paste each command.

By the end you will have:

- PostgreSQL + Redis running in Docker,
- the database migrated and seeded with demo companies/outlets,
- the API on **http://localhost:4000**, the web app on **http://localhost:3000**,
  and the background worker running.

---

## 1. Prerequisites

You need three tools: **Node.js 20**, **pnpm**, and **Docker**.

### 1.1 Node.js 20 (via nvm)

The repo pins Node 20 (`.nvmrc` contains `20`). Use **nvm** so you can match it exactly.

```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Reload your shell so `nvm` is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install and use Node 20 (reads .nvmrc once you're inside the repo)
nvm install 20
nvm use 20

# Verify
node --version   # should print v20.x.x
```

### 1.2 pnpm

Komuta is a **pnpm + Turborepo** monorepo. The package manager is pinned to
`pnpm@10.33.0` in `package.json`. Install pnpm via Corepack (ships with Node 20):

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate

# Verify
pnpm --version   # should print 10.33.0
```

### 1.3 Docker (with the Compose plugin)

You only need Docker locally to run **PostgreSQL and Redis** — the app itself runs from
source via `pnpm dev`.

- **macOS / Windows:** install **Docker Desktop** from <https://www.docker.com/products/docker-desktop/>.
- **Linux:** follow the official install at <https://docs.docker.com/engine/install/>
  and the Compose plugin at <https://docs.docker.com/compose/install/linux/>.

Verify:

```bash
docker --version
docker compose version   # note: "docker compose" (v2 plugin), not "docker-compose"
```

---

## 2. Clone the repository

```bash
git clone https://github.com/alioanka/komuta.git
cd komuta

# Make sure you're on Node 20 (reads .nvmrc)
nvm use
```

---

## 3. Install dependencies

From the repo root, this installs every workspace package (api, web, worker, and the
shared packages) in one pass:

```bash
pnpm install
```

> If you see a message about approving build scripts (Prisma, esbuild, etc.), run
> `pnpm approve-builds` or accept the prompt — these are expected native builds.

---

## 4. Create your `.env`

The canonical list of environment variables lives in **`.env.example`**. Copy it:

```bash
cp .env.example .env
```

For local development the defaults already work, because `.env.example` points at the
local Docker Postgres/Redis:

- `DATABASE_URL=postgresql://komuta:komuta@localhost:5432/komuta?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `WEB_PORT=3000`, `API_PORT=4000`
- `APP_URL=http://localhost:3000`, `API_URL=http://localhost:4000`

**You do not need real WhatsApp/Telegram credentials to develop locally.** Leave
`WHATSAPP_*`, `META_*`, and `TELEGRAM_*` blank — you can simulate inbound webhooks with
curl (see §9). The only value worth generating locally is a JWT secret so logins work:

```bash
# Generate two strong secrets and paste them into .env
openssl rand -base64 48   # → JWT_ACCESS_SECRET
openssl rand -base64 48   # → JWT_REFRESH_SECRET
```

The seeded login passwords come from these `.env` values (change them if you like):

```
SEED_OWNER_EMAIL=ozer@komuta.local
SEED_OWNER_PASSWORD=ChangeMe!Owner1
SEED_ACCOUNTANT_EMAIL=salih@komuta.local
SEED_ACCOUNTANT_PASSWORD=ChangeMe!Salih1
```

---

## 5. Start the dev infrastructure (Postgres + Redis)

This brings up **only** the databases, not the app:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Check they are healthy:

```bash
docker compose -f docker-compose.dev.yml ps
```

You should see a `postgres` and a `redis` container in the `running` (and `healthy`)
state. Postgres listens on `localhost:5432`, Redis on `localhost:6379`.

> **Stopping later:** `docker compose -f docker-compose.dev.yml down`
> (add `-v` to also wipe the data volumes for a clean slate).

---

## 6. Migrate the database

This creates all tables from the Prisma schema:

```bash
pnpm db:migrate
```

Under the hood this runs `prisma migrate dev` inside the `@komuta/api` workspace, which
applies migrations and regenerates the Prisma client. If it asks you to name a new
migration, only do so when you have intentionally changed the schema.

---

## 7. Seed demo data

This inserts the 4 companies, their brands and outlets, and the owner/accountant users
(using the `SEED_*` values from your `.env`):

```bash
pnpm db:seed
```

The seed script prints the login emails and passwords it used. **Note them.**

---

## 8. Run everything (`pnpm dev`)

From the repo root, a single command starts the API, the web app, and the worker
together via Turborepo:

```bash
pnpm dev
```

| Service        | URL / port                 | What it is                                  |
|----------------|----------------------------|---------------------------------------------|
| **web**        | http://localhost:3000      | Next.js dashboards & operator UI            |
| **api**        | http://localhost:4000      | NestJS REST API + WhatsApp webhook + SSE    |
| **worker**     | (no port — background)     | BullMQ consumer processing messages         |

Open **http://localhost:3000**, log in with the seeded owner credentials, and you
should see the dashboard.

Quick API health check:

```bash
curl -s http://localhost:4000/health
```

---

## 9. Simulate an inbound WhatsApp message (local testing)

You don't need Meta to test the pipeline. Meta delivers messages as an HTTP `POST` to
`/webhooks/whatsapp`. You can replay that shape with curl.

> **Signature note:** in production the API validates an `X-Hub-Signature-256` HMAC
> header (computed with `META_APP_SECRET`). For local testing, leave `META_APP_SECRET`
> empty in `.env` so signature verification is skipped, **or** compute the signature
> (see the snippet at the end). Do not disable verification in production.

### 9.1 The webhook verification handshake (GET)

Meta first verifies your webhook with a `GET` that echoes a challenge. Simulate it:

```bash
curl -s "http://localhost:4000/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=$(grep '^META_VERIFY_TOKEN=' .env | cut -d= -f2)&hub.challenge=12345"
# Expected response body: 12345
```

### 9.2 An inbound text message (POST)

Save this as `scratch-message.json` (edit `from`, `text`, and `id`):

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": { "display_phone_number": "905555555555", "phone_number_id": "PHONE_NUMBER_ID" },
            "contacts": [{ "profile": { "name": "Test Employee" }, "wa_id": "905551112233" }],
            "messages": [
              {
                "from": "905551112233",
                "id": "wamid.LOCALTEST0001",
                "timestamp": "1718900000",
                "type": "text",
                "text": { "body": "Çamlıca 73256,76" }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Post it:

```bash
curl -s -X POST http://localhost:4000/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  --data @scratch-message.json
```

The API should return `200` immediately; the **worker** then parses `73256,76`,
resolves the outlet from the token `Çamlıca`, and writes the record. Watch the worker
output in your `pnpm dev` terminal.

> Change the `id` (`wamid....`) on each test — Komuta **deduplicates by message id**
> (idempotency), so re-sending the same id is intentionally a no-op.

### 9.3 (Optional) Computing a valid signature header

If you want to test *with* signature verification on, compute the HMAC over the exact
request body:

```bash
SECRET="$(grep '^META_APP_SECRET=' .env | cut -d= -f2)"
SIG="sha256=$(openssl dgst -sha256 -hmac "$SECRET" scratch-message.json | sed 's/^.* //')"
curl -s -X POST http://localhost:4000/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  --data @scratch-message.json
```

---

## 10. Tests, linting, and type-checking

All run from the repo root via Turborepo (it runs them across every workspace):

```bash
pnpm test        # run all unit/integration tests
pnpm lint        # ESLint across the monorepo
pnpm typecheck   # TypeScript type-checking (no emit)
```

You can also format:

```bash
pnpm format        # write Prettier formatting
pnpm format:check  # verify formatting in CI
```

To run a task for a single package only, use a filter, e.g.:

```bash
pnpm --filter @komuta/money test     # just the money package's tests
```

---

## 11. Common local issues

| Symptom                                            | Fix                                                                             |
|----------------------------------------------------|---------------------------------------------------------------------------------|
| `pnpm db:migrate` can't connect to the database    | Is Docker up? `docker compose -f docker-compose.dev.yml ps`. Check `DATABASE_URL`. |
| Port 3000 or 4000 already in use                   | Stop the other process, or change `WEB_PORT` / `API_PORT` in `.env`.            |
| Login fails after seeding                          | Re-check `SEED_*` values; re-run `pnpm db:seed`.                                 |
| Worker doesn't process messages                    | Is Redis up? Check `REDIS_URL`. Is the worker running in your `pnpm dev` output? |
| `pnpm` not found                                   | `corepack enable && corepack prepare pnpm@10.33.0 --activate`.                   |

Next: deploy it for real — [`02_DEPLOYMENT_CONTABO.md`](./02_DEPLOYMENT_CONTABO.md).
