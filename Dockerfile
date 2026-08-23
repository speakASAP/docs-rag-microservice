FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig*.json ./
COPY src/ ./src/

RUN npm run build

# ---- runner ----
FROM node:20-slim AS runner

# GitSyncService shells out to `git rev-parse HEAD` to detect whether a repo
# changed since the last ingestion. Without the binary the spawn fails with
# ENOENT, every repo revision falls back to 'unknown', and the incremental
# check can never skip — forcing a full re-index of all repos on every run.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps

COPY --chown=node:node --from=builder /app/dist ./dist

USER node

EXPOSE 3397

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3397/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
