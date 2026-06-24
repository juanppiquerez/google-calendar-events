# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# -----------------------------------------------------------------------------
# Install dependencies (all workspaces)
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/prisma ./apps/api/prisma
RUN npm ci

# -----------------------------------------------------------------------------
# Build the API and generate Prisma client
# -----------------------------------------------------------------------------
FROM deps AS build
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
COPY eslint.config.mjs .prettierrc ./
RUN npm run build --workspace=api

# -----------------------------------------------------------------------------
# Production runtime (no devDependencies)
# -----------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/prisma ./apps/api/prisma

RUN npm ci --omit=dev --workspace=api --include-workspace-root && \
    npx prisma generate --schema=./apps/api/prisma/schema.prisma && \
    npm cache clean --force

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh && \
    chown -R nestjs:nodejs /app

WORKDIR /app/apps/api
USER nestjs
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
