# syntax=docker/dockerfile:1

# ────────────────────────────────────────────
# Stage 1: Install dependencies + build (npm workspaces + Turborepo)
# This stage is tagged separately (:builder-latest) and used as-is by the
# one-off `migrate` service — it must KEEP devDependencies (drizzle-kit)
# available, so pruning must NOT happen here.
# ────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace manifests first to leverage Docker layer caching.
# scripts/setup-env.js is copied too: `npm ci` triggers the root "prepare"
# lifecycle hook, which runs that script — it's a no-op here (no .env.example
# alongside the package.json-only layer yet), but the file must exist or
# the hook crashes with MODULE_NOT_FOUND. We deliberately do NOT use
# `--ignore-scripts`, since that would also skip bcrypt's native node-gyp
# build step (hence python3/make/g++ above).
COPY package.json package-lock.json turbo.json ./
COPY scripts ./scripts
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

RUN npm ci

# Copy source code
COPY packages/database ./packages/database
COPY apps/api ./apps/api

# Build @moaspace/database then @moaspace/api (turbo resolves the dependency order)
RUN npx turbo run build --filter=@moaspace/api...

# ────────────────────────────────────────────
# Stage 2: Prune devDependencies — SEPARATE from `builder` on purpose.
# `docker build --target builder` must stop BEFORE this, or the `migrate`
# service's drizzle-kit (a devDependency) would get stripped out too.
# ────────────────────────────────────────────
FROM builder AS pruned

RUN npm prune --omit=dev

# ────────────────────────────────────────────
# Stage 3: Production runtime image
# ────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Hoisted, pruned (prod-only) node_modules from the `pruned` stage
COPY --from=pruned /app/node_modules ./node_modules
COPY --from=pruned /app/package.json ./package.json

# @moaspace/database: compiled dist/ + package.json (resolved via the
# node_modules/@moaspace/database workspace symlink, so the path must match)
COPY --from=pruned /app/packages/database/dist ./packages/database/dist
COPY --from=pruned /app/packages/database/package.json ./packages/database/package.json

# @moaspace/api: compiled dist/ + package.json
COPY --from=pruned /app/apps/api/dist ./apps/api/dist
COPY --from=pruned /app/apps/api/package.json ./apps/api/package.json

EXPOSE 3000

CMD ["node", "apps/api/dist/src/main.js"]
