# Chatwoot pilot runbook

This runbook separates safe connectivity checks from webhook activation and external sending. Use a dedicated Chatwoot test account and inbox for the live gates. The eChat workspace remains isolated by organization and integration connection.

## 1. Configure the integration

In **Channels**, save the Chatwoot base URL, account ID, inbox ID, and API token. The token is encrypted at rest and is never returned to the browser after saving. Use an HTTPS Chatwoot URL outside local development.

Set `PUBLIC_APP_URL` to the public HTTPS origin that Chatwoot can reach. Do not expose PostgreSQL. Keep `ECHAT_OUTBOUND_MODE=disabled` unless the controlled pilot has passed its inbound and idempotency gates.

## 2. Run the read-only check

Use **Testar leitura** in Channels or run:

```sh
npm run qualify:chatwoot
```

The connection check only reads the configured account, inbox list, first contacts page, first conversation page, and webhook list. It checks the configured account and inbox IDs and whether the expected webhook URL subscribes to `message_created`. It does not create a webhook, contact, conversation, or message.

For the command-line qualifier, configure these environment values without committing them:

```text
CHATWOOT_BASE_URL
CHATWOOT_ACCOUNT_ID
CHATWOOT_API_TOKEN
CHATWOOT_INBOX_ID
CHATWOOT_EXPECTED_WEBHOOK_URL or PUBLIC_APP_URL
```

Missing credentials produce `LIVE_TEST_BLOCKED_NO_LIVE_CREDENTIALS`. Do not report a real Chatwoot gate as passing until the live account and inbox checks succeed.

## 3. Sync test data

After the read-only check passes, use **Sincronizar** to import the configured inbox’s contacts, conversations, and text messages. Run it twice and confirm that the same contacts, identities, conversations, and messages are updated instead of duplicated. Sync pages are bounded; inspect the imported counts before using the inbox as a complete historical archive.

Contact and conversation mappings include the organization and integration connection. Matching by a bare external ID across integrations is not allowed.

## 4. Activate inbound webhooks

Only an Owner or Admin can activate the webhook. First complete a successful read-only check, then use the separate **Ativar webhook** action and confirm the account, inbox, and destination shown in the confirmation dialog. Activation requires a recent check and a public HTTPS `PUBLIC_APP_URL`; it registers only `message_created` at:

```text
/api/v1/webhooks/chatwoot
```

The webhook secret is stored encrypted. The receiver verifies the HMAC against the raw request body, enforces a five-minute timestamp window, requires `X-Chatwoot-Delivery`, and scopes processing to the integration whose secret validated the request. Duplicate deliveries and message IDs are ignored safely.

## 5. Operate the Inbox

The Inbox refreshes while visible every five seconds, marks a conversation read when it is opened, orders recent activity first, and keeps contact, assignment, status, and CRM linkage inside the organization. Agents can operate the inbox; only Owners and Admins can manage integrations and activate webhooks.

Unsupported Chatwoot channels fail with `UNSUPPORTED_CHANNEL`; they are not silently mapped to another channel type. Text is the supported message type for this pilot.

## 6. Enable a controlled outbound pilot

Start with outbound disabled. For a test only, set:

```text
ECHAT_OUTBOUND_MODE=pilot
ECHAT_OUTBOUND_PILOT_CONVERSATIONS=<integration-id>:<external-conversation-id>
```

The allowlist is scoped to both the eChat integration and its external Chatwoot conversation. The server also checks that the integration is connected and belongs to that conversation. All other Chatwoot sends fail closed with `403 OUTBOUND_NOT_AUTHORIZED`. Each browser send includes an `Idempotency-Key`; replays of the same request do not send twice.

Only after read-only qualification, inbound delivery, tenant isolation, and deduplication pass, send one neutral message to an explicitly authorized test conversation. Confirm the created Chatwoot message ID is stored locally and that the resulting webhook echo does not add a second local message. Do not use a customer conversation.

After the test, immediately restore:

```text
ECHAT_OUTBOUND_MODE=disabled
ECHAT_OUTBOUND_PILOT_CONVERSATIONS=
```

The Inbox and Channels pages display the active outbound mode. In disabled mode, Chatwoot message and private-note sending are blocked in the UI and the API.

## 7. Local and CI validation

Use only the dedicated `echat_test` database for local integration tests and browser QA. Never point migration, seed, or test commands at a development or production database unless that target is explicitly the test database.

```sh
npm ci
npm run db:migrate
npm run check
npm run test
npm run build
npm run test:integration
npm run qualify:chatwoot
git diff --check
```

The CI migration job applies migrations to a fresh PostgreSQL database before running validation. Keep real Chatwoot credentials, session secrets, database URLs, and encryption keys out of source control and CI logs.

## Official Chatwoot API references

- [Get an account](https://developers.chatwoot.com/api-reference/account/get-account-details)
- [List account inboxes](https://developers.chatwoot.com/api-reference/inboxes/list-all-inboxes)
- [List contacts](https://developers.chatwoot.com/api-reference/contacts/list-contacts)
- [List conversations](https://developers.chatwoot.com/api-reference/conversations/conversations-list)
- [Create a conversation message](https://developers.chatwoot.com/api-reference/messages/create-new-message)
- [List webhooks](https://developers.chatwoot.com/api-reference/webhooks/list-all-webhooks)
- [Add a webhook](https://developers.chatwoot.com/api-reference/webhooks/add-a-webhook)
