# ── Stage 1: Build ──────────────────────────────────────────────────────────
# node:20-slim (Debian/glibc), NICHT alpine/musl: das Lockfile behält gezielt
# nur die glibc-x64-Binaries (@rollup/rollup-linux-x64-gnu, @esbuild/linux-x64).
FROM node:20-slim AS builder
WORKDIR /app

RUN npm install -g pnpm@10.14.0

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/api-server/package.json            ./artifacts/api-server/
COPY artifacts/audi-innovation-hub/package.json  ./artifacts/audi-innovation-hub/
COPY scripts/package.json                         ./scripts/
COPY lib/db/package.json                          ./lib/db/
COPY lib/api-zod/package.json                     ./lib/api-zod/
COPY lib/api-spec/package.json                    ./lib/api-spec/
COPY lib/api-client-react/package.json            ./lib/api-client-react/
COPY lib/integrations-anthropic-ai/package.json  ./lib/integrations-anthropic-ai/

RUN pnpm install --frozen-lockfile

# Copy source code and build
COPY artifacts/api-server/  ./artifacts/api-server/
COPY lib/                   ./lib/
# tsconfig.json der Pakete macht `extends: "../../tsconfig.base.json"`
COPY tsconfig.base.json tsconfig.json ./

RUN pnpm --filter @workspace/api-server run build

# ── Stage 2: Run ────────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/artifacts/api-server/dist ./dist

EXPOSE 8000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
