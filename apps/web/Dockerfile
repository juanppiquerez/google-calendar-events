# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

# -----------------------------------------------------------------------------
# Install dependencies (all workspaces)
# -----------------------------------------------------------------------------
FROM base AS deps
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci --ignore-scripts

# -----------------------------------------------------------------------------
# Build the Next.js app
# -----------------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY packages/shared-types ./packages/shared-types
COPY apps/web ./apps/web
COPY eslint.config.mjs .prettierrc ./
RUN npm run build --workspace=web

# -----------------------------------------------------------------------------
# Production runtime (no devDependencies)
# -----------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
