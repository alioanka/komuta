# Komuta

> Tek komuta merkezi — a single command center for Özer Kaya's food-service
> businesses.

Komuta listens to a WhatsApp Business number where employees text their daily
revenue, parses and routes each amount to the right outlet, stores it, and
surfaces everything in role-based Turkish dashboards. The accountant enters
monthly data; the system monitors missing reports and alerts via in-app,
Telegram and WhatsApp.

## Stack
pnpm + Turborepo monorepo · TypeScript (strict, ESM) · NestJS API · BullMQ
worker · Next.js dashboard · PostgreSQL + Prisma · Redis · Meta WhatsApp Cloud
API · Docker Compose behind Nginx + Certbot.

## Quick start (local)
```bash
nvm use                                  # Node 20
pnpm install
cp .env.example .env                     # fill values (see docs/SETUP_CHECKLIST.md)
docker compose -f docker-compose.dev.yml up -d   # postgres + redis
pnpm db:migrate && pnpm db:seed          # schema + demo data (prints logins)
pnpm dev                                 # api :4000 · web :3000 · worker
```

Then open http://localhost:3000 and sign in with the seeded credentials printed
by the seed (change them immediately).

## Layout
```
packages/money    amount parser + message extractor + TR normalizer (pure, tested)
packages/shared   enums, RBAC, resolution decision engine, zod schemas, i18n
packages/config   brand + constants
apps/api          NestJS REST + WhatsApp webhook + SSE
apps/worker       BullMQ scheduled jobs (missing-revenue scan)
apps/web          Next.js dashboard (Turkish UI)
infra/            nginx, certbot, deploy/backup scripts, systemd
docs/             setup, deployment, Meta/WhatsApp, Telegram, user guide, ADRs
```

## Scripts
`pnpm build` · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm dev`

## Documentation
Start with [docs/00_OVERVIEW.md](docs/00_OVERVIEW.md) and
[CLAUDE.md](CLAUDE.md). Deployment lives in
[docs/02_DEPLOYMENT_CONTABO.md](docs/02_DEPLOYMENT_CONTABO.md); the human launch
checklist is [docs/SETUP_CHECKLIST.md](docs/SETUP_CHECKLIST.md).

## License
Proprietary — internal use for Komuta / Özer Kaya group.
