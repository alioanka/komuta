# ----------------------------------------------------------------------------
# Komuta API (@komuta/api) — NestJS, listens on API_PORT=4000.
#
# Multi-stage, monorepo-aware build:
#   1. deps    — install the full workspace from the frozen lockfile
#   2. build   — prisma generate + turbo build for @komuta/api
#   3. prune   — produce a production-only deploy with just @komuta/api
#   4. runner  — minimal runtime image
#
# Migrations are NOT run here. Run them separately after `up`:
#   docker compose exec -T api pnpm --filter @komuta/api prisma migrate deploy
#
# Build context is the repo root (see docker-compose.yml).
# ----------------------------------------------------------------------------

# ---- base ----
FROM node:20-alpine AS base
RUN corepack enable
# Prisma + native deps need these on alpine.
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

# ---- deps: install the whole workspace ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
# Shared workspace packages the api depends on.
COPY packages ./packages
# Root-level prisma schema/seed.
COPY prisma ./prisma
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile

# ---- build: generate prisma client + compile ----
FROM deps AS build
RUN pnpm --filter @komuta/api prisma generate
RUN pnpm turbo run build --filter=@komuta/api
# Create a production-only deployment of @komuta/api (with prod deps + dist).
RUN pnpm --filter @komuta/api deploy --prod --legacy /prod/api

# ---- runner: minimal runtime ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api ./
EXPOSE 4000
# Compiled Nest entrypoint. Migrations are applied out-of-band (see header).
CMD ["node", "dist/main.js"]
