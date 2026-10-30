# syntax=docker/dockerfile:1.7
#
# テレマ・営業DX — one image: the API serves the built web app on port 3000.
#
#   builder  full workspace; builds everything. Also used as the `tools` service in
#            docker-compose.prod.yml (prisma migrate deploy, the CLIs).
#   runtime  only the API's production dependencies and the built files.
#
# VITE_BASE_PATH is baked into the web build: `/` for its own domain, or e.g.
# `/telesales-dx/` when the app lives under a path of an existing site.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS builder
# prisma.config.ts reads DATABASE_URL even for `prisma generate`; no database is used here.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# Dependencies first, so a code-only change reuses this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_BASE_PATH=/
RUN VITE_BASE_PATH=${VITE_BASE_PATH} pnpm build
# The API with production dependencies only (the generated Prisma client is in dist).
RUN pnpm --filter @telesales/api deploy --prod --legacy --ignore-scripts /out \
  && rm -rf /out/src /out/test /out/storage \
  && mkdir -p /out/web && cp -r apps/web/dist/. /out/web/

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    API_PORT=3000 \
    WEB_DIST_DIR=/app/web \
    FILE_STORAGE_DIR=/app/storage
WORKDIR /app
COPY --from=builder --chown=node:node /out ./
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Staging runs the app in a 320 MiB container. Without a cap, V8 sizes its heap from the
# host's RAM, lets garbage pile up, and the kernel kills the container (10/29: OOM after
# ~24h). 200 MiB of heap keeps it collecting, leaving room for buffers and native memory.
CMD ["node", "--enable-source-maps", "--max-old-space-size=200", "dist/main.js"]
