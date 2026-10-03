ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS provider_type text NOT NULL DEFAULT 'MOCK';
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS provider_inbox_id text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS last_error_at timestamptz;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;
UPDATE integration_accounts SET provider_type = CASE WHEN provider = 'chatwoot' THEN 'CHATWOOT' ELSE 'MOCK' END;

ALTER TABLE channels ADD COLUMN IF NOT EXISTS provider_type text;
UPDATE channels c SET provider_type = ia.provider_type FROM integration_accounts ia WHERE c.integration_account_id = ia.id AND c.provider_type IS NULL;

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel_connection_id text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel_type text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS provider_type text;
UPDATE conversations c SET channel_connection_id = ch.integration_account_id, channel_type = ch.type, provider_type = ch.provider_type FROM channels ch WHERE ch.id = c.channel_id AND (c.channel_connection_id IS NULL OR c.channel_type IS NULL OR c.provider_type IS NULL);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_connection_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel_type text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider_type text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'INBOUND';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_identity text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_identity text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'TEXT';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'SENT';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider_created_at timestamptz;
UPDATE messages m SET channel_connection_id = c.channel_connection_id, channel_type = c.channel_type, provider_type = c.provider_type, direction = CASE WHEN m.sender = 'AGENT' THEN 'OUTBOUND' ELSE 'INBOUND' END, provider_created_at = m.created_at FROM conversations c WHERE c.id = m.conversation_id AND (m.channel_connection_id IS NULL OR m.channel_type IS NULL OR m.provider_type IS NULL OR m.provider_created_at IS NULL);

DROP INDEX IF EXISTS channels_org_external_unique;
CREATE UNIQUE INDEX IF NOT EXISTS channels_org_connection_external_unique ON channels (organization_id, integration_account_id, external_id);
DROP INDEX IF EXISTS conversations_org_external_unique;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_org_connection_external_unique ON conversations (organization_id, channel_connection_id, external_id);
DROP INDEX IF EXISTS messages_org_external_unique;
CREATE UNIQUE INDEX IF NOT EXISTS messages_org_connection_external_unique ON messages (organization_id, channel_connection_id, external_id);

CREATE TABLE IF NOT EXISTS contact_identities (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  contact_id text NOT NULL,
  channel_connection_id text NOT NULL,
  channel_type text NOT NULL,
  provider_type text NOT NULL,
  external_contact_id text NOT NULL,
  address text,
  username text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_identities_connection_external_unique UNIQUE (organization_id, channel_connection_id, external_contact_id)
);
CREATE INDEX IF NOT EXISTS contact_identities_org_contact_idx ON contact_identities (organization_id, contact_id);

CREATE TABLE IF NOT EXISTS message_attachments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  message_id text NOT NULL,
  external_url text,
  mime_type text NOT NULL,
  filename text,
  size integer,
  provider_asset_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_attachments_message_idx ON message_attachments (organization_id, message_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_identities_org_fk') THEN ALTER TABLE contact_identities ADD CONSTRAINT contact_identities_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_identities_contact_fk') THEN ALTER TABLE contact_identities ADD CONSTRAINT contact_identities_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_identities_connection_fk') THEN ALTER TABLE contact_identities ADD CONSTRAINT contact_identities_connection_fk FOREIGN KEY (channel_connection_id) REFERENCES integration_accounts(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_org_fk') THEN ALTER TABLE message_attachments ADD CONSTRAINT message_attachments_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_message_fk') THEN ALTER TABLE message_attachments ADD CONSTRAINT message_attachments_message_fk FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_connection_fk') THEN ALTER TABLE conversations ADD CONSTRAINT conversations_connection_fk FOREIGN KEY (channel_connection_id) REFERENCES integration_accounts(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_connection_fk') THEN ALTER TABLE messages ADD CONSTRAINT messages_connection_fk FOREIGN KEY (channel_connection_id) REFERENCES integration_accounts(id) ON DELETE SET NULL; END IF;
END $$;
