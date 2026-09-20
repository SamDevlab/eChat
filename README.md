# eChat

eChat é uma fundação B2B de inbox omnichannel e CRM. O runtime usa PostgreSQL como source of truth; a UI não mantém estado de negócio em `localStorage` e o Mock Provider só simula a integração externa.

## Desenvolvimento local

PostgreSQL nativo é obrigatório para a API:

```powershell
$env:DATABASE_URL="postgres://usuario:senha@localhost:5432/echat"
$env:APP_URL="http://localhost:5173"
$env:INTEGRATION_ENCRYPTION_KEY="<32-byte-hex-key>"
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Abra `http://localhost:5173` e use **Criar um novo workspace** para iniciar sem uma senha pré-configurada. O cadastro cria a organização, Owner, pipeline padrão e sessão em uma transação. O seed continua disponível para dados de demonstração:

- `owner@echat.local` / `local-only`
- `admin@echat.local` / `local-only`
- `agente@echat.local` / `local-only`

O seed é idempotente e é bloqueado quando `NODE_ENV=production`. Para testes de banco, configure um banco separado em `DATABASE_URL_TEST` e execute `npm run test:integration`; sem essa variável, o gate é reportado como bloqueado, sem tocar no banco de desenvolvimento.

`INTEGRATION_ENCRYPTION_KEY` deve conter 32 bytes em hexadecimal (64 caracteres) ou Base64. Tokens de integração e segredos de webhook são cifrados com AES-256-GCM no servidor; não coloque valores reais em `.env.example`, commits ou logs. O formulário de Canais permite configurar Chatwoot por organização, testar a conta e iniciar sincronização de contatos, conversas e mensagens. Em desenvolvimento, HTTP só é aceito para `localhost`; em produção, use HTTPS.

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
npm run test:live
git diff --check
```

Chatwoot é opcional. A conexão customer-ready é configurada em **Canais** por um Owner/Admin. O adapter usa server-to-server os endpoints oficiais de conta, contatos, conversas, mensagens e webhooks; os segredos nunca são enviados ao browser. Para um webhook realmente registrável, defina `PUBLIC_APP_URL` com uma URL HTTPS pública; em `localhost`, o teste de conexão não tenta registrar webhook externo.

## Piloto live Chatwoot

`npm run test:live` é um probe opt-in e somente leitura: exige `CHATWOOT_BASE_URL`, `CHATWOOT_ACCOUNT_ID` e `CHATWOOT_API_TOKEN`, valida a conta e lê a primeira página de contatos e conversas. Sem essas variáveis, termina com `LIVE_TEST_BLOCKED_NO_LIVE_CREDENTIALS` sem tocar no Chatwoot. Ele nunca envia mensagem nem registra webhook; o fluxo completo usa **Canais** após configurar a integração, uma `PUBLIC_APP_URL` HTTPS pública e um contato/conversa de teste explicitamente autorizado. O segredo retornado no registro do webhook é persistido apenas cifrado com `INTEGRATION_ENCRYPTION_KEY`.

O design system de referência permanece congelado em [`docs/design-system.md`](docs/design-system.md). Exportação de screenshots é um passo manual e não faz parte deste gate.
