# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/formula-engine/package.json ./packages/formula-engine/
COPY packages/crdt/package.json ./packages/crdt/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages ./packages
COPY apps/api ./apps/api

# Build packages
RUN pnpm --filter @jasheets/shared build
RUN pnpm --filter @jasheets/formula-engine build
RUN pnpm --filter @jasheets/crdt build

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build the API
RUN pnpm --filter api build

# Create a self-contained production dependency tree. Copying pnpm workspace
# symlinks alone leaves broken links in the runtime image.
RUN pnpm --filter api deploy --prod /prod/api

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nestjs
RUN adduser --system --uid 1001 nestjs

# Copy the deployable app and migration entrypoint.
COPY --from=builder /prod/api ./
COPY docker/api-entrypoint.sh /usr/local/bin/jasheets-api-entrypoint
RUN chmod 755 /usr/local/bin/jasheets-api-entrypoint

USER nestjs

EXPOSE 4000

ENV PORT=4000

ENTRYPOINT ["jasheets-api-entrypoint"]
CMD ["node", "dist/src/main.js"]
