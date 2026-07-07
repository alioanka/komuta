# ----------------------------------------------------------------------------
# Komuta Web (@komuta/web) — Next.js, listens on WEB_PORT=3000.
#
# Multi-stage, monorepo-aware build using Next.js "standalone" output:
#   1. deps    — install the full workspace from the frozen lockfile
#   2. build   — turbo build for @komuta/web
#   3. runner  — copy the self-contained standalone server
#
# Requires `output: "standalone"` in apps/web/next.config.* — the standalone
# server bundles only the files it needs and emits apps/web/server.js.
#
# Build context is the repo root (see docker-compose.yml).
# ----------------------------------------------------------------------------

# ---- base ----
FROM node:20-alpine AS base
RUN corepack enable
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time — the
# public API base URL must be provided here (see docker-compose.yml build args).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm turbo run build --filter=@komuta/web

# ---- runner: standalone Next.js server ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Run as the unprivileged node user provided by the base image.
USER node

# Standalone output: a minimal server + only the deps it actually uses.
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public

EXPOSE 3000
# Next.js standalone emits the server entrypoint at apps/web/server.js.
CMD ["node", "apps/web/server.js"]
