ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'COMPANY';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

ALTER TABLE channels ADD COLUMN IF NOT EXISTS integration_account_id text;

ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT 'Integração';
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS credential_ciphertext text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS credential_iv text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS credential_tag text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS credential_version integer;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS webhook_secret_ciphertext text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS webhook_secret_iv text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS webhook_secret_tag text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS webhook_secret_version integer;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS webhook_registration_id text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS last_check_at timestamptz;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS last_error_code text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS last_sync_started_at timestamptz;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS last_sync_completed_at timestamptz;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS last_sync_status text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS last_sync_error text;

CREATE TABLE IF NOT EXISTS organization_invites (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by text NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_invites_org_idx ON organization_invites (organization_id, created_at);
CREATE INDEX IF NOT EXISTS organization_invites_org_email_idx ON organization_invites (organization_id, email);

CREATE TABLE IF NOT EXISTS opportunity_conversations (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  opportunity_id text NOT NULL,
  conversation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_conversations_unique UNIQUE (opportunity_id, conversation_id)
);
CREATE INDEX IF NOT EXISTS opportunity_conversations_org_idx ON opportunity_conversations (organization_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channels_integration_account_fk') THEN ALTER TABLE channels ADD CONSTRAINT channels_integration_account_fk FOREIGN KEY (integration_account_id) REFERENCES integration_accounts(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_invites_org_fk') THEN ALTER TABLE organization_invites ADD CONSTRAINT organization_invites_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_invites_creator_fk') THEN ALTER TABLE organization_invites ADD CONSTRAINT organization_invites_creator_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_conversations_org_fk') THEN ALTER TABLE opportunity_conversations ADD CONSTRAINT opportunity_conversations_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_conversations_opp_fk') THEN ALTER TABLE opportunity_conversations ADD CONSTRAINT opportunity_conversations_opp_fk FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_conversations_conversation_fk') THEN ALTER TABLE opportunity_conversations ADD CONSTRAINT opportunity_conversations_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE; END IF;
END $$;
