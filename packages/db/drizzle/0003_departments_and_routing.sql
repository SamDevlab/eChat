CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT 'teal',
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_org_slug_unique UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS departments_org_idx ON departments (organization_id);

CREATE TABLE IF NOT EXISTS department_members (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  department_id text NOT NULL,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT department_members_department_user_unique UNIQUE (department_id, user_id)
);
CREATE INDEX IF NOT EXISTS department_members_org_idx ON department_members (organization_id);

CREATE TABLE IF NOT EXISTS routing_rules (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  department_id text NOT NULL,
  channel_id text,
  name text NOT NULL,
  keywords jsonb NOT NULL DEFAULT '[]',
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS routing_rules_org_position_idx ON routing_rules (organization_id, position);
CREATE INDEX IF NOT EXISTS routing_rules_org_idx ON routing_rules (organization_id);

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS department_id text;
CREATE INDEX IF NOT EXISTS conversations_org_department_idx ON conversations (organization_id, department_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'departments_org_fk') THEN
    ALTER TABLE departments ADD CONSTRAINT departments_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'department_members_org_fk') THEN
    ALTER TABLE department_members ADD CONSTRAINT department_members_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'department_members_department_fk') THEN
    ALTER TABLE department_members ADD CONSTRAINT department_members_department_fk FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'department_members_user_fk') THEN
    ALTER TABLE department_members ADD CONSTRAINT department_members_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routing_rules_org_fk') THEN
    ALTER TABLE routing_rules ADD CONSTRAINT routing_rules_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'routing_rules_department_fk') THEN
    ALTER TABLE routing_rules ADD CONSTRAINT routing_rules_department_fk FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_department_fk') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_department_fk FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;
