# ----------------------------------------------------------------------------
# Komuta Worker (@komuta/worker) — BullMQ background worker, no HTTP port.
#
# Multi-stage, monorepo-aware build (mirrors apps/api/Dockerfile):
#   1. deps    — install the full workspace from the frozen lockfile
#   2. build   — prisma generate + turbo build for @komuta/worker
#   3. prune   — production-only deploy of @komuta/worker
#   4. runner  — minimal runtime image
#
# Build context is the repo root (see docker-compose.yml).
# ----------------------------------------------------------------------------

# ---- base ----
FROM node:20-alpine AS base
RUN corepack enable
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY prisma ./prisma
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
# The worker shares the Prisma client with the api.
RUN pnpm --filter @komuta/worker prisma generate || true
RUN pnpm turbo run build --filter=@komuta/worker
RUN pnpm --filter @komuta/worker deploy --prod --legacy /prod/worker

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/worker ./
CMD ["node", "dist/main.js"]
