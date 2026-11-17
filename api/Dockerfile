# syntax=docker/dockerfile:1
# API image (CLAUDE.md §11). Build context: repository root (shared/ + lockfile).
#   docker build -f api/Dockerfile -t ny-dashboard-api .

ARG NODE_VERSION=24.14.1

# ── Build: install the workspace, bundle the API (tsup), prune to production deps ────────────
FROM node:${NODE_VERSION}-bookworm-slim AS build
# Prisma's schema engine (migrate) needs OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY api/ api/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --offline --filter "@ny-dashboard/api..."
RUN pnpm --filter @ny-dashboard/api build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm --filter @ny-dashboard/api deploy --prod /out

# ── Runtime: Node + production deps + bundle + migrations + snapshot ─────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=180s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.API_PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
ENTRYPOINT ["docker/entrypoint.sh"]
