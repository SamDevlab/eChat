DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = current_schema()::regnamespace
      AND conname = 'webhook_events_integration_fk'
  ) THEN
    ALTER TABLE webhook_events
      ADD CONSTRAINT webhook_events_integration_fk
      FOREIGN KEY (integration_account_id) REFERENCES integration_accounts(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE connamespace = current_schema()::regnamespace
      AND conname = 'webhook_events_org_fk'
  ) THEN
    ALTER TABLE webhook_events
      ADD CONSTRAINT webhook_events_org_fk
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;
END $$;
