ALTER TABLE messages ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS messages_org_conversation_idempotency_unique
  ON messages (organization_id, conversation_id, idempotency_key);

DROP INDEX IF EXISTS integration_accounts_provider_external_unique;
CREATE UNIQUE INDEX IF NOT EXISTS integration_accounts_org_provider_account_inbox_unique
  ON integration_accounts (
    organization_id,
    provider,
    base_url,
    external_account_id,
    COALESCE(provider_inbox_id, '')
  );
