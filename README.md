# eChat

eChat is a Brazilian B2B omnichannel inbox and CRM foundation: conversation → contact → service → opportunity → pipeline → sale.

## Local demo

```bash
npm install
npm run db:seed
npm run dev
```

Open `http://localhost:5173` and sign in with one of the local-only users:

- `owner@echat.local` / `local-only`
- `admin@echat.local` / `local-only`
- `agente@echat.local` / `local-only`

The browser app persists the demo state in local storage so the main flow survives reloads. The API exposes the authenticated, tenant-scoped contracts and uses the mock messaging provider by default.

## Commands

```bash
npm run check
npm run test
npm run build
git diff --check
```

Chatwoot is implemented as an adapter but is intentionally not required for the local MVP. Configure it only when a live account is available.
