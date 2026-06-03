# ── Stage 1: Build React app ─────────────────────────────────────────────────
# node:20-slim (Debian/glibc), NICHT alpine/musl: das Lockfile behält gezielt
# nur die glibc-x64-Binary @rollup/rollup-linux-x64-gnu für den Vite-Build.
FROM node:20-slim AS builder
WORKDIR /app

RUN npm install -g pnpm@10.14.0

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/audi-innovation-hub/package.json  ./artifacts/audi-innovation-hub/
COPY artifacts/api-server/package.json           ./artifacts/api-server/
COPY scripts/package.json                        ./scripts/
COPY lib/api-zod/package.json                    ./lib/api-zod/
COPY lib/api-client-react/package.json           ./lib/api-client-react/
COPY lib/api-spec/package.json                   ./lib/api-spec/
COPY lib/db/package.json                         ./lib/db/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/

RUN pnpm install --frozen-lockfile

COPY artifacts/audi-innovation-hub/  ./artifacts/audi-innovation-hub/
COPY lib/                            ./lib/
# tsconfig.json des Frontends macht `extends: "../../tsconfig.base.json"`
COPY tsconfig.base.json tsconfig.json ./

# VITE_CLERK_PUBLISHABLE_KEY is baked into the JS bundle at build time
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY
ENV PORT=4173
ENV BASE_PATH=/

RUN pnpm --filter @workspace/audi-innovation-hub run build

# ── Stage 2: nginx static server ─────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy built React app
COPY --from=builder /app/artifacts/audi-innovation-hub/dist/public /usr/share/nginx/html

# nginx.conf is mounted as a volume at runtime (allows hot-swap without rebuild)
# Remove default config to avoid conflicts
RUN rm /etc/nginx/conf.d/default.conf

EXPOSE 80 443
