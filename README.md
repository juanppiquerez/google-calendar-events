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

**PostgreSQL** provides reliable ACID transactions, strong constraint support, and efficient range queries — important for detecting overlapping bookings. **Prisma** gives type-safe database access, declarative schema migrations, and a generated client that integrates cleanly with NestJS. The schema includes `User`, `Booking`, `BookingIdempotency`, and `GoogleToken` (encrypted OAuth credentials for Calendar access).

### Authentication: Auth0 for application identity only

**Auth0** handles user login (Google as the identity provider inside Auth0) and issues JWT access tokens for our API. The session lives in **httpOnly cookies** managed by `@auth0/nextjs-auth0` on the Next.js app — tokens are never stored in `localStorage` or client-side React state.

**Auth0 is not used for Google Calendar API access.** Calendar OAuth (refresh tokens, scopes, etc.) is a separate, explicit OAuth2 flow via `googleapis`. Treat Auth0 purely as the application session / identity provider.

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

Prisma cannot express this constraint declaratively, so it lives in a manual SQL migration (`btree_gist` extension + `Booking_no_overlap_confirmed`). When the constraint fires, Postgres returns SQLSTATE `23P01`, which the service maps to a `409 Conflict` with a user-facing message distinct from the in-code overlap check.

3. **Google Calendar (optional)** — If the user has connected Google Calendar, `BookingsService` calls `GoogleService.hasConflict()` via the `CalendarConflictChecker` interface **after** the internal check and **before** INSERT. A busy block on the user's primary calendar returns `409` with a message that explicitly mentions Google Calendar. Users without a connected calendar skip this step entirely.

**Idempotency** — Optional `Idempotency-Key` header on `POST /bookings` is stored in a `BookingIdempotency` table (unique per `userId` + key). Replays within 10 minutes return the original response without creating a duplicate booking.

### Google Calendar integration

Google Calendar is connected through a **separate OAuth2 flow** from Auth0 login. The user must already be authenticated (Auth0 JWT) and then explicitly choose "Conectar Google Calendar" on the dashboard.

#### Google Cloud Console setup

1. Create or select a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Calendar API**: APIs & Services → Library → search "Google Calendar API" → Enable.
3. Configure the **OAuth consent screen** (External or Internal, add your test users if External).
4. Create **OAuth 2.0 credentials** → Application type: **Web application**:
   - **Authorized redirect URIs:** `http://localhost:3001/api/v1/google/callback` (adjust host/port for production; must match `GOOGLE_REDIRECT_URI` in `.env`).
5. Copy **Client ID** and **Client secret** into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Generate `ENCRYPTION_KEY` for token encryption at rest:

   ```bash
   openssl rand -hex 32
   ```

#### OAuth scope choice

We request `https://www.googleapis.com/auth/calendar.freebusy` — the most restrictive scope that still allows [`calendar.freebusy.query`](https://developers.google.com/calendar/api/v3/reference/freebusy/query). Unlike `calendar.readonly`, it grants only **availability** (busy/free blocks), not event titles, attendees, or descriptions. That matches our use case: detect overlaps without reading calendar content, improving privacy and least-privilege.

Conflict checks use **`freebusy.query`**, not `events.list`, because freebusy resolves recurring events into concrete busy intervals server-side.

#### API endpoints

| Method | Route | Auth | Description |
| ------ | ----- | ---- | ----------- |
| `GET` | `/api/v1/google/connect` | JWT | Returns Google OAuth authorization URL |
| `GET` | `/api/v1/google/callback` | — | OAuth redirect; exchanges code, stores encrypted tokens, redirects to frontend success page |
| `GET` | `/api/v1/google/status` | JWT | Returns `{ connected, isValid }` |
| `DELETE` | `/api/v1/google/disconnect` | JWT | Revokes token with Google and deletes `GoogleToken` row |

OAuth tokens (`accessToken`, `refreshToken`) are encrypted with **AES-256-GCM** before persistence (`ENCRYPTION_KEY`). The encryption service is the only layer that ever sees plaintext tokens.

#### Resilience: degrade on Google API failure

If Google Calendar is unreachable (429, 503, timeouts) after exponential-backoff retries, or if the user's refresh token was revoked (`invalid_grant`), **`hasConflict` returns `false`** and the booking proceeds based on internal checks only. A **WARNING** is logged (`no se pudo verificar Google Calendar, booking creado sin esa verificación`). This is an explicit product decision: Google Calendar is an enhancement, not a hard dependency — we never return `500` or block booking creation solely because Google failed.

Revoked tokens are marked `isValid: false` so the dashboard can prompt the user to reconnect.

#### Connect flow (end-to-end)

1. Authenticated user clicks **Conectar Google Calendar** on the dashboard
2. Frontend calls `GET /api/v1/google/connect` → receives `{ url }` → redirects to Google
3. User grants consent (`access_type=offline`, `prompt=consent` to obtain refresh token)
4. Google redirects to `GET /api/v1/google/callback?code=…&state=…`
5. API exchanges code, encrypts tokens, upserts `GoogleToken`, redirects to `/dashboard/google-connected`
6. Future `POST /bookings` calls `freebusy.query` on the primary calendar before insert

## Security

Hardening measures applied before production testing and deploy:

| Area | Measure |
| ---- | ------- |
| Rate limiting | `@nestjs/throttler` globally (100 req/min/IP); **10 req/min** on `POST /bookings`, `GET /google/connect`, and `GET /google/callback` |
| CORS | Exact frontend origin from `APP_BASE_URL` only; `credentials: false` (browser uses same-origin Next.js API routes) |
| HTTP headers | **Helmet** for standard security headers |
| Input validation | Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` on all DTOs |
| Errors | Global exception filter: generic `5xx` messages in production; details logged server-side |
| Health | `GET /api/v1/health` (no auth) checks PostgreSQL connectivity — used by Docker healthcheck |
| Secrets | Env-only configuration; `.env` gitignored; Google OAuth tokens encrypted at rest |
| Auth0 session | httpOnly cookies via `@auth0/nextjs-auth0`; JWT never in DOM, query params, or client `console` |
| XSS | User content (e.g. booking titles) rendered via React text nodes only — no `dangerouslySetInnerHTML` |

See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities and operational guidance.

<!-- Additional decisions will be documented here phase by phase. -->
