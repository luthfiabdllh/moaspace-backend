# syntax=docker/dockerfile:1

# ────────────────────────────────────────────
# Stage 1: Install dependencies + build (npm workspaces + Turborepo)
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

# Drop devDependencies, keeping only what's needed to run the built output
RUN npm prune --omit=dev

# ────────────────────────────────────────────
# Stage 2: Production runtime image
# ────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Hoisted, pruned (prod-only) node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# @moaspace/database: compiled dist/ + package.json (resolved via the
# node_modules/@moaspace/database workspace symlink, so the path must match)
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json

# @moaspace/api: compiled dist/ + package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 3000

CMD ["node", "apps/api/dist/src/main.js"]
