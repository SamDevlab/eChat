# eChat

eChat é uma fundação B2B de inbox omnichannel e CRM. O runtime usa PostgreSQL como source of truth; a UI não mantém estado de negócio em `localStorage` e o Mock Provider só simula a integração externa.

## Desenvolvimento local

PostgreSQL nativo é obrigatório para a API:

```powershell
$env:DATABASE_URL="postgres://usuario:senha@localhost:5432/echat"
$env:APP_URL="http://localhost:5173"
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Abra `http://localhost:5173` com um destes usuários locais:

- `owner@echat.local` / `local-only`
- `admin@echat.local` / `local-only`
- `agente@echat.local` / `local-only`

O seed é idempotente e é bloqueado quando `NODE_ENV=production`. Para testes de banco, configure um banco separado em `DATABASE_URL_TEST` e execute `npm run test:integration`; sem essa variável, o gate é reportado como bloqueado, sem tocar no banco de desenvolvimento.

## Comandos

```bash
npm run dev
npm run check
npm run test
npm run build
npm run db:generate
npm run db:migrate
npm run db:seed
npm run test:integration
git diff --check
```

Chatwoot é opcional. Configure `MESSAGING_PROVIDER=chatwoot`, `CHATWOOT_BASE_URL`, `CHATWOOT_API_TOKEN`, `CHATWOOT_ACCOUNT_ID` e `CHATWOOT_WEBHOOK_SECRET` no ambiente do servidor; o token nunca é enviado ao browser. O adapter usa o endpoint oficial de mensagens e webhooks server-to-server.

O design system de referência permanece congelado em [`docs/design-system.md`](docs/design-system.md). Exportação de screenshots é um passo manual e não faz parte deste gate.
