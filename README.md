# eChat

eChat é uma fundação B2B de inbox omnichannel e CRM. O runtime usa PostgreSQL como source of truth; a UI não mantém estado de negócio em `localStorage` e o Mock Provider só simula a integração externa.

## Omnichannel backend

O eChat é dono de organizações, permissões, contatos, identidades externas, conversas, mensagens e CRM. Providers são somente a camada de comunicação com APIs externas; o Chatwoot é o primeiro provider operacional e não é a fonte de verdade do domínio.

Canais suportados no domínio nesta versão:

- WhatsApp
- Instagram Direct
- Email

As conexões de canal permanecem em `integration_accounts`, com `channel_type`, `provider_type`, conta/inbox externo, status operacional e credenciais cifradas no servidor. O mesmo `ChatwootProvider` recebe o contexto da conexão e pode operar inboxes diferentes sem acoplar o domínio ao Chatwoot. WebChat e outros canais ficam preservados apenas para compatibilidade de dados/UI e não são habilitados pela nova normalização.

Identidades externas são vinculadas por organização, conexão e ID externo em `contact_identities`; uma pessoa pode ter WhatsApp, Instagram e Email no mesmo contato interno. Conversas e mensagens mantêm o mapping da conexão, direção, tipo, status de entrega e timestamps do provider. Anexos têm uma representação mínima sem download automático.

## Desenvolvimento local

PostgreSQL nativo é obrigatório para a API. Para o LAB local, copie `.env.example` para `.env` e mantenha as duas URLs no banco isolado `echat_test`, com `DATABASE_ENV=TEST`:

```powershell
npm ci
Copy-Item .env.example .env
npm run db:migrate
npm run dev
```

Abra `http://localhost:5173` e use **Criar um novo workspace** para iniciar sem uma senha pré-configurada. O cadastro cria a organização, Owner, pipeline padrão e sessão em uma transação. O seed continua disponível para dados de demonstração:

- `owner@echat.local` / `local-only`
- `admin@echat.local` / `local-only`
- `agente@echat.local` / `local-only`

O seed é bloqueado em produção e exige `DATABASE_ENV=TEST`, `DATABASE_URL` em `echat_test` e autorização local explícita `ECHAT_ALLOW_DEMO_SEED=1`. Para testes de banco, `DATABASE_URL_TEST` também deve apontar somente para `echat_test`; sem essa variável, o gate é ignorado sem tocar em outro banco.

`INTEGRATION_ENCRYPTION_KEY` deve conter 32 bytes em hexadecimal (64 caracteres) ou Base64. Tokens de integração e segredos de webhook são cifrados com AES-256-GCM no servidor; após salvar, não são retornados ao navegador. Não coloque valores reais em `.env.example`, commits ou logs. O formulário de Canais permite configurar Chatwoot por organização, testar a conta e iniciar sincronização de contatos, conversas e mensagens. Em desenvolvimento, HTTP só é aceito para `localhost`; em produção, use HTTPS.

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

## Guias do piloto

- [Instalação](docs/commercial-pilot-installation.md)
- [Atendentes](docs/operator-guide.md)
- [Administradores](docs/admin-guide.md)
- [Checklist do piloto](docs/commercial-pilot-checklist.md)
- [Atualizações](docs/update-procedure.md)
- [Preparação WhatsApp/Instagram](docs/channel-preparation.md)
- [Auditoria de dependências](docs/dependency-audit.md)


## Qualificação read-only do Chatwoot

A última barreira de integração real pode ser executada sem enviar mensagens e sem registrar/mutar webhooks:

```bash
npm run qualify:chatwoot
```

Valores necessários no ambiente:

- `CHATWOOT_BASE_URL`;
- `CHATWOOT_ACCOUNT_ID`;
- `CHATWOOT_API_TOKEN`.

O qualificador executa somente leitura:
- valida a conta;
- lê a primeira página de contatos;
- lê a primeira página de conversas;
- valida o inbox quando `CHATWOOT_INBOX_ID` estiver definido;
- lista webhooks e compara a URL esperada quando `CHATWOOT_EXPECTED_WEBHOOK_URL` ou `PUBLIC_APP_URL` estiver definido.

Para transformar ausência do webhook esperado em falha:

```dotenv
CHATWOOT_REQUIRE_WEBHOOK_MATCH=1
```

A execução continua sem:
- enviar mensagens;
- registrar webhook;
- alterar conversa/contato;
- imprimir token.

Se as credenciais não estiverem presentes, o comando retorna `LIVE_TEST_BLOCKED_NO_LIVE_CREDENTIALS` em vez de fingir PASS.
