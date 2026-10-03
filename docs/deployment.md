# eChat production deployment

This is the VPS-oriented production foundation. It assumes PostgreSQL is managed separately (for example, a VPS service or an existing managed database); `compose.production.yml` intentionally starts only the API and Caddy/web proxy.

## Requirements

- A Linux host with Docker Engine and Compose v2.
- A PostgreSQL database reachable from the API container, with the database user allowed to run the checked-in Drizzle migrations.
- DNS `A`/`AAAA` records for the chosen public hostname pointing to the VPS.
- TCP 80 and 443 open to the VPS. The API port 3001 is internal to the Compose network and is not published.

## Configuration and start

Copy `.env.example` to a host-only `.env` and set `NODE_ENV=production`, a PostgreSQL `DATABASE_URL`, an HTTPS `APP_URL`, a strong random `SESSION_SECRET`, and an exactly 32-byte `INTEGRATION_ENCRYPTION_KEY` (64 hex characters or base64). `PUBLIC_APP_URL` is optional and defaults conceptually to the same public origin for callback links; when set it must also be HTTPS. Set `ECHAT_DOMAIN` to the DNS hostname. Never commit this file.

Run migrations from a controlled release step, then start the stack:

```text
docker compose -f compose.production.yml run --rm api node apps/api/dist/migrate.js
docker compose -f compose.production.yml up -d --build
```

Caddy terminates public HTTPS, serves the Vite build with SPA fallback, and sends only `/api/*` to the internal API. It overwrites forwarded client-IP headers with the immediate peer supplied by Caddy. The API deliberately uses its socket peer for rate limiting and does not blindly trust user-supplied `X-Forwarded-For`; direct API access is prevented by the absence of a published API port.

## Verification and callbacks

Check `GET https://<host>/api/health` for liveness and `GET https://<host>/api/ready` for database/schema readiness. A ready response is `{ "ok": true }`; dependency failures return `503` with `{ "ok": false }` and no connection details. The signed Chatwoot callback URL is `https://<host>/api/v1/webhooks/chatwoot`; register it only after the public HTTPS route, integration secret, and signature verification have been qualified. Webhook delivery IDs are persisted for idempotent replay handling.

## Rollback and backup

Keep the previous image tag and Compose configuration. To roll back, deploy the previous immutable image/configuration and run only migrations compatible with that release; do not reverse a migration blindly. Take PostgreSQL backups before migrations, retain encrypted off-host copies, and periodically test restoration. Caddy's `/data` volume contains certificates and must be retained across restarts.

For a local production-like proxy smoke without a public deployment, set `ECHAT_DOMAIN=:80`, `HTTP_PORT=18080`, and `HTTPS_PORT=18443` in a temporary environment file and point `DATABASE_URL` at an isolated test schema/database. This does not create or expose a production database.
