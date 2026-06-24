# Booking System

Full-stack monorepo for a scheduling system that validates booking conflicts against Google Calendar.

## Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Monorepo | npm workspaces + Turborepo          |
| API      | NestJS, Prisma, PostgreSQL 16       |
| Web      | Next.js 15 (App Router), Tailwind CSS |
| Shared   | `@booking/shared-types` workspace package |

## Repository structure

```
.
├── apps/
│   ├── api/                 # NestJS REST API
│   │   ├── prisma/          # Schema and migrations
│   │   └── src/
│   └── web/                 # Next.js frontend
├── packages/
│   └── shared-types/        # Shared TypeScript interfaces/DTOs
├── .github/workflows/       # CI pipelines
├── docker-compose.yml
└── turbo.json
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- [Node.js](https://nodejs.org/) 20+ (for local development without Docker)

## Quick start with Docker

1. Copy the environment template and adjust values if needed:

   ```bash
   cp .env.example .env
   ```

2. Build and start all services (PostgreSQL, API, Web):

   ```bash
   docker compose up --build
   ```

3. Open the apps:

   - **Web:** http://localhost:3000 (or the `WEB_PORT` value from `.env`)
   - **API:** http://localhost:3001

> **Note:** If ports `5432` or `3000` are already in use on your machine, adjust `DATABASE_URL` (host port `5433` is mapped in `docker-compose.yml`) and `WEB_PORT` in `.env` before running `docker compose up`.

The API container runs `prisma migrate deploy` automatically on startup before launching the NestJS server.

## Database migrations

### With Docker (automatic)

Migrations are applied by the API entrypoint on every container start via `prisma migrate deploy`.

### Local development

1. Start PostgreSQL (or run only the database service):

   ```bash
   docker compose up postgres -d
   ```

2. From the repo root, install dependencies:

   ```bash
   npm install
   ```

3. Apply migrations:

   ```bash
   npm run prisma:migrate:deploy --workspace=api
   ```

   Or create a new migration during development:

   ```bash
   npm run prisma:migrate:dev --workspace=api
   ```

## Local development (without Docker for apps)

```bash
cp .env.example .env
npm install
docker compose up postgres -d
npm run prisma:migrate:deploy --workspace=api
npm run dev
```

This starts both `api` and `web` in watch mode via Turborepo.

## Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start all apps in development mode       |
| `npm run build`      | Build all apps and packages              |
| `npm run lint`       | Lint all workspaces                      |
| `npm run typecheck`  | Type-check all workspaces                |
| `npm run test`       | Run tests across workspaces              |
| `npm run format`     | Format code with Prettier                |

## Architecture decisions

### Monorepo tooling: Turborepo + npm workspaces

We use **npm workspaces** for dependency linking (e.g. `@booking/shared-types` is consumed by both apps without a separate publish step) and **Turborepo** on top to orchestrate `lint`, `build`, `test`, and `typecheck` with caching and parallel execution. Turborepo adds minimal configuration (`turbo.json`) while making CI and local dev scripts consistent across packages. For a two-app monorepo, workspaces alone would work, but Turborepo pays off immediately in the GitHub Actions pipeline and as the project grows.

### Database: PostgreSQL 16 with Prisma

**PostgreSQL** provides reliable ACID transactions, strong constraint support, and efficient range queries — important for detecting overlapping bookings. **Prisma** gives type-safe database access, declarative schema migrations, and a generated client that integrates cleanly with NestJS. The initial schema includes `User` and `Booking` models; Google OAuth token storage will be added in a later phase.

<!-- Additional decisions will be documented here phase by phase. -->
