CREATE TABLE IF NOT EXISTS opportunity_emails (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  opportunity_id text NOT NULL,
  actor_id text NOT NULL,
  from_email text NOT NULL,
  to_email text NOT NULL,
  cc text NOT NULL DEFAULT '',
  bcc text NOT NULL DEFAULT '',
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text NOT NULL DEFAULT '',
  status text NOT NULL,
  provider text NOT NULL DEFAULT 'lark_smtp',
  provider_message_id text,
  error_code text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opportunity_emails_org_opportunity_idx ON opportunity_emails (organization_id, opportunity_id, created_at);
CREATE INDEX IF NOT EXISTS opportunity_emails_org_idx ON opportunity_emails (organization_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_emails_org_fk') THEN ALTER TABLE opportunity_emails ADD CONSTRAINT opportunity_emails_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_emails_opportunity_fk') THEN ALTER TABLE opportunity_emails ADD CONSTRAINT opportunity_emails_opportunity_fk FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunity_emails_actor_fk') THEN ALTER TABLE opportunity_emails ADD CONSTRAINT opportunity_emails_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT; END IF;
END $$;
