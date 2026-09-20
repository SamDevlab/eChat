CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at, updated_at)
SELECT 'membership-' || u.id, u.organization_id, u.id, COALESCE(u.role, 'AGENT'), 'ACTIVE', now(), now()
FROM users u
WHERE u.organization_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_email_idx;
ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
ALTER TABLE users DROP COLUMN IF EXISTS role;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);

CREATE UNIQUE INDEX IF NOT EXISTS organization_members_org_user_unique ON organization_members (organization_id, user_id);
CREATE INDEX IF NOT EXISTS organization_members_org_idx ON organization_members (organization_id);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS contacts_org_idx ON contacts (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_external_unique ON contacts (organization_id, external_id);

ALTER TABLE channels ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS conversations integer NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE channels ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS channels_org_idx ON channels (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS channels_org_external_unique ON channels (organization_id, external_id);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS conversations_org_status_idx ON conversations (organization_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_org_external_unique ON conversations (organization_id, external_id);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS external_id text;
UPDATE messages m SET organization_id = c.organization_id FROM conversations c WHERE c.id = m.conversation_id AND m.organization_id IS NULL;
ALTER TABLE messages ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS messages_org_conversation_created_idx ON messages (organization_id, conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS messages_org_external_unique ON messages (organization_id, external_id);

ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS pipelines_org_idx ON pipelines (organization_id);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pipeline_stages' AND column_name = 'order') THEN
    ALTER TABLE pipeline_stages RENAME COLUMN "order" TO position;
  END IF;
END $$;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS position integer;
UPDATE pipeline_stages SET position = 1 WHERE position IS NULL;
ALTER TABLE pipeline_stages ALTER COLUMN position SET NOT NULL;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_pipeline_position_unique ON pipeline_stages (pipeline_id, position);
CREATE INDEX IF NOT EXISTS pipeline_stages_org_idx ON pipeline_stages (organization_id);

INSERT INTO pipelines (id, organization_id, name, created_at, updated_at)
SELECT o.id || '-pipeline-default', o.id, 'Pipeline principal', now(), now()
FROM organizations o
ON CONFLICT (id) DO NOTHING;
INSERT INTO pipeline_stages (id, organization_id, pipeline_id, name, key, position, color, created_at, updated_at)
SELECT o.id || '-stage-' || v.key, o.id, o.id || '-pipeline-default', v.name, v.key, v.position, v.color, now(), now()
FROM organizations o
CROSS JOIN (VALUES
  ('NEW_LEAD', 'Novo lead', 1, 'teal'), ('CONTACTED', 'Contato realizado', 2, 'blue'), ('PROPOSAL', 'Proposta', 3, 'violet'),
  ('NEGOTIATION', 'Negociação', 4, 'amber'), ('WON', 'Ganho', 5, 'green'), ('LOST', 'Perdido', 6, 'red')
) AS v(key, name, position, color)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS pipeline_id text;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS stage_id text;
UPDATE opportunities o SET pipeline_id = p.id, stage_id = s.id
FROM pipelines p
JOIN pipeline_stages s ON s.pipeline_id = p.id
WHERE p.organization_id = o.organization_id AND p.id = o.organization_id || '-pipeline-default' AND s.key = o.stage;
ALTER TABLE opportunities ALTER COLUMN pipeline_id SET NOT NULL;
ALTER TABLE opportunities ALTER COLUMN stage_id SET NOT NULL;
ALTER TABLE opportunities DROP COLUMN IF EXISTS stage;
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS opportunities_org_stage_idx ON opportunities (organization_id, stage_id);
CREATE INDEX IF NOT EXISTS opportunities_org_idx ON opportunities (organization_id);

ALTER TABLE opportunity_activities ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS opportunity_activities_org_idx ON opportunity_activities (organization_id, opportunity_id);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tags ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS tags_org_name_unique ON tags (organization_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS contact_tags_contact_tag_unique ON contact_tags (contact_id, tag_id);
CREATE INDEX IF NOT EXISTS contact_tags_org_idx ON contact_tags (organization_id);

ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS external_account_id text;
UPDATE integration_accounts SET external_account_id = external_id WHERE external_account_id IS NULL;
ALTER TABLE integration_accounts ALTER COLUMN external_account_id SET NOT NULL;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS base_url text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS credential_ref text;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE integration_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE integration_accounts DROP COLUMN IF EXISTS external_id;
CREATE UNIQUE INDEX IF NOT EXISTS integration_accounts_provider_external_unique ON integration_accounts (provider, external_account_id);
CREATE INDEX IF NOT EXISTS integration_accounts_org_idx ON integration_accounts (organization_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  organization_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS auth_sessions_active_lookup_idx ON auth_sessions (organization_id, expires_at);

CREATE TABLE IF NOT EXISTS webhook_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  integration_account_id text NOT NULL,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  payload_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT webhook_events_integration_event_unique UNIQUE (integration_account_id, external_event_id)
);
CREATE INDEX IF NOT EXISTS webhook_events_org_idx ON webhook_events (organization_id, received_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_org_fk') THEN ALTER TABLE organization_members ADD CONSTRAINT organization_members_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_user_fk') THEN ALTER TABLE organization_members ADD CONSTRAINT organization_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_org_fk') THEN ALTER TABLE contacts ADD CONSTRAINT contacts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_owner_fk') THEN ALTER TABLE contacts ADD CONSTRAINT contacts_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channels_org_fk') THEN ALTER TABLE channels ADD CONSTRAINT channels_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_org_fk') THEN ALTER TABLE conversations ADD CONSTRAINT conversations_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_contact_fk') THEN ALTER TABLE conversations ADD CONSTRAINT conversations_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_channel_fk') THEN ALTER TABLE conversations ADD CONSTRAINT conversations_channel_fk FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_org_fk') THEN ALTER TABLE messages ADD CONSTRAINT messages_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_fk') THEN ALTER TABLE messages ADD CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_assignee_fk') THEN ALTER TABLE conversations ADD CONSTRAINT conversations_assignee_fk FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipelines_org_fk') THEN ALTER TABLE pipelines ADD CONSTRAINT pipelines_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_org_fk') THEN ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_stages_pipeline_fk') THEN ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_pipeline_fk FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_org_fk') THEN ALTER TABLE opportunities ADD CONSTRAINT opportunities_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_contact_fk') THEN ALTER TABLE opportunities ADD CONSTRAINT opportunities_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_pipeline_fk') THEN ALTER TABLE opportunities ADD CONSTRAINT opportunities_pipeline_fk FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_stage_fk') THEN ALTER TABLE opportunities ADD CONSTRAINT opportunities_stage_fk FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_owner_fk') THEN ALTER TABLE opportunities ADD CONSTRAINT opportunities_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_activities_org_fk') THEN ALTER TABLE opportunity_activities ADD CONSTRAINT opportunity_activities_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_activities_opp_fk') THEN ALTER TABLE opportunity_activities ADD CONSTRAINT opportunity_activities_opp_fk FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_org_fk') THEN ALTER TABLE tags ADD CONSTRAINT tags_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_tags_org_fk') THEN ALTER TABLE contact_tags ADD CONSTRAINT contact_tags_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_tags_contact_fk') THEN ALTER TABLE contact_tags ADD CONSTRAINT contact_tags_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_tags_tag_fk') THEN ALTER TABLE contact_tags ADD CONSTRAINT contact_tags_tag_fk FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'integration_accounts_org_fk') THEN ALTER TABLE integration_accounts ADD CONSTRAINT integration_accounts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_sessions_user_fk') THEN ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auth_sessions_org_fk') THEN ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_events_integration_fk') THEN ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_integration_fk FOREIGN KEY (integration_account_id) REFERENCES integration_accounts(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_events_org_fk') THEN ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
END $$;
