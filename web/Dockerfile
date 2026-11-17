# syntax=docker/dockerfile:1
# Web image (CLAUDE.md §11): static Vite build served by nginx, /api proxied to the API.
# Build context: repository root (shared/ + lockfile).
#   docker build -f web/Dockerfile -t ny-dashboard-web .

ARG NODE_VERSION=24.14.1

# ── Build: install the workspace and build the SPA ──────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm fetch

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY web/ web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --offline --filter "@ny-dashboard/web..."
RUN pnpm --filter @ny-dashboard/web build

# ── Runtime: unprivileged nginx (port 8080) ──────────────────────────────────────────────────
FROM nginxinc/nginx-unprivileged:1.28-alpine AS runtime
ENV API_UPSTREAM=api:3000
COPY web/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /repo/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
