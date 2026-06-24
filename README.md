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

### Authentication: Auth0 for application identity only

**Auth0** handles user login (Google as the identity provider inside Auth0) and issues JWT access tokens for our API. The session lives in **httpOnly cookies** managed by `@auth0/nextjs-auth0` on the Next.js app — tokens are never stored in `localStorage` or client-side React state.

**Auth0 is not used for Google Calendar API access.** Calendar OAuth (refresh tokens, scopes, etc.) will be implemented in a later phase as a separate, explicit OAuth2 flow. Treat Auth0 purely as the application session / identity provider.

The NestJS API validates Auth0 JWTs with `passport-jwt` + `jwks-rsa` (signature via JWKS, `aud` and `iss` checks). On first authenticated request, the API upserts a `User` row keyed by `auth0Id`.

### Auth0 setup (Dashboard)

1. **Create a Regular Web Application** in [Auth0 Dashboard](https://manage.auth0.com) → Applications → Create Application → Regular Web Applications.

2. **Application settings** (replace port if you changed `WEB_PORT` / `APP_BASE_URL`):

   | Setting | Value |
   | ------- | ----- |
   | Allowed Callback URLs | `http://localhost:3000/auth/callback` |
   | Allowed Logout URLs | `http://localhost:3000` |
   | Allowed Web Origins | `http://localhost:3000` |

   Copy **Domain**, **Client ID**, and **Client Secret** into `.env`.

3. **Enable Google social login**: Authentication → Social → Google (use your Google OAuth credentials or Auth0 dev keys for testing).

4. **Create an API** (Applications → APIs → Create API):
   - **Name:** Booking System API (or any name)
   - **Identifier:** e.g. `https://booking-api` — this is your `AUTH0_AUDIENCE`
   - **Signing Algorithm:** RS256

5. **Add custom claims to the access token** (optional but recommended so `email` and `name` reach the API): Actions → Library → Build Custom → *Login / Post Login*:

   ```javascript
   exports.onExecutePostLogin = async (event, api) => {
     const namespace = 'https://booking.app';
     if (event.authorization) {
       api.accessToken.setCustomClaim(`${namespace}/email`, event.user.email);
       api.accessToken.setCustomClaim(`${namespace}/name`, event.user.name);
     }
   };
   ```

   Deploy the action and add it to the Login flow.

6. **Generate `AUTH0_SECRET`** for cookie encryption:

   ```bash
   openssl rand -hex 32
   ```

7. Fill `.env` from `.env.example`: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_AUDIENCE`, `AUTH0_SECRET`, `APP_BASE_URL`.

### Auth flow (end-to-end)

1. User clicks **Iniciar sesión con Google** → `/auth/login?connection=google-oauth2`
2. Auth0 completes OAuth; SDK stores session in httpOnly cookies
3. Dashboard server component calls `GET /api/v1/users/me` with `Authorization: Bearer <access_token>`
4. API validates JWT, upserts `User`, returns profile
5. Expired/invalid JWT → API returns `401` → frontend redirects to login

### Booking conflict detection: application check + PostgreSQL exclusion constraint

Overlapping bookings for the same user are prevented at two layers:

1. **Application layer** — Before inserting, `BookingsService` queries for existing `CONFIRMED` bookings whose time range overlaps the requested slot (`startTime < new.endTime AND endTime > new.startTime`). Adjacent slots (where one ends exactly when the other starts) are allowed.

2. **Database layer (defense in depth)** — A PostgreSQL `EXCLUDE USING gist` constraint on `Booking` prevents two `CONFIRMED` rows for the same `userId` from having overlapping `tsrange(startTime, endTime, '[)')` values. This closes the race-condition window where two concurrent requests both pass the application check before either INSERT completes.

Prisma cannot express this constraint declaratively, so it lives in a manual SQL migration (`btree_gist` extension + `Booking_no_overlap_confirmed`). When the constraint fires, Postgres returns SQLSTATE `23P01`, which the service maps to a `409 Conflict` with a user-facing message distinct from the in-code overlap check (reserved for a future Google Calendar conflict message in phase 3).

**Idempotency** — Optional `Idempotency-Key` header on `POST /bookings` is stored in a `BookingIdempotency` table (unique per `userId` + key). Replays within 10 minutes return the original response without creating a duplicate booking.

<!-- Additional decisions will be documented here phase by phase. -->
