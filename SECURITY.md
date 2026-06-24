# Security Policy

## Reporting vulnerabilities

If you discover a security issue, please report it privately to the project maintainers rather than opening a public issue. Include steps to reproduce and the potential impact.

## Secrets and configuration

- All sensitive values (`ENCRYPTION_KEY`, `AUTH0_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `AUTH0_SECRET`, database credentials) must be supplied via environment variables.
- Never commit `.env` or real secrets to version control. Use `.env.example` as a template only.
- Rotate `ENCRYPTION_KEY` only with a planned data migration — existing encrypted Google tokens cannot be decrypted with a new key.

## Authentication and authorization

- Application identity uses **Auth0** JWTs validated server-side (`passport-jwt` + JWKS).
- Google Calendar uses a **separate OAuth2 flow**; tokens are encrypted at rest (AES-256-GCM) before persistence.
- API routes (except health and Google OAuth callback) require a valid Bearer token.

## Transport and headers

- Production deployments should terminate TLS at the load balancer or reverse proxy.
- The API sets standard security headers via **Helmet**.
- **CORS** allows only the exact frontend origin configured in `APP_BASE_URL`; credentials are not enabled on cross-origin API responses because the browser talks to the Next.js BFF on the same origin.

## Rate limiting

- Global limit: 100 requests per minute per IP.
- Stricter limit (10/min): `POST /bookings`, `GET /google/connect`, `GET /google/callback`.

## Input validation

- Request bodies and query DTOs use `class-validator` with global `whitelist` and `forbidNonWhitelisted` — unknown fields are rejected.

## Error handling

- In production (`NODE_ENV=production`), `5xx` responses return a generic message; full stack traces are logged server-side only.

## Logging

- Do not log access tokens, refresh tokens, or full JWTs. Logs use non-sensitive identifiers (e.g. `userId`) where context is needed.

## Dependency updates

- Run `npm audit` periodically and address high-severity findings before production deploys.
