CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  sku text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(14,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_org_sku_unique UNIQUE (organization_id, sku)
);
CREATE INDEX IF NOT EXISTS products_org_idx ON products (organization_id);

CREATE TABLE IF NOT EXISTS sales (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  contact_id text NOT NULL,
  owner_id text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  subtotal numeric(14,2) NOT NULL,
  discount numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  source text NOT NULL DEFAULT 'CRM',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_org_status_idx ON sales (organization_id, status);
CREATE INDEX IF NOT EXISTS sales_org_idx ON sales (organization_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  sale_id text NOT NULL,
  product_id text,
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  total numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sale_items_org_sale_idx ON sale_items (organization_id, sale_id);

CREATE TABLE IF NOT EXISTS contracts (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  sale_id text,
  contact_id text NOT NULL,
  number text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  total numeric(14,2) NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  renewal_at timestamptz,
  signature_provider text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_org_number_unique UNIQUE (organization_id, number)
);
CREATE INDEX IF NOT EXISTS contracts_org_status_idx ON contracts (organization_id, status);

CREATE TABLE IF NOT EXISTS goals (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  user_id text,
  name text NOT NULL,
  metric text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  target numeric(14,2) NOT NULL,
  actual numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS goals_org_period_idx ON goals (organization_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS goals_org_user_idx ON goals (organization_id, user_id);

CREATE TABLE IF NOT EXISTS commission_plans (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  name text NOT NULL,
  basis text NOT NULL DEFAULT 'SALE_TOTAL',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_plans_org_name_unique UNIQUE (organization_id, name)
);
CREATE INDEX IF NOT EXISTS commission_plans_org_idx ON commission_plans (organization_id);

CREATE TABLE IF NOT EXISTS commission_rules (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  plan_id text NOT NULL,
  min_amount numeric(14,2) NOT NULL DEFAULT 0,
  max_amount numeric(14,2),
  rate numeric(8,4) NOT NULL DEFAULT 0,
  fixed_amount numeric(14,2) NOT NULL DEFAULT 0,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_rules_plan_position_unique UNIQUE (plan_id, position)
);
CREATE INDEX IF NOT EXISTS commission_rules_org_idx ON commission_rules (organization_id);

CREATE TABLE IF NOT EXISTS commission_entries (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  sale_id text,
  seller_id text NOT NULL,
  plan_id text,
  rule_snapshot jsonb NOT NULL DEFAULT '{}',
  basis_amount numeric(14,2) NOT NULL,
  commission_amount numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_entries_sale_seller_unique UNIQUE (sale_id, seller_id)
);
CREATE INDEX IF NOT EXISTS commission_entries_org_seller_idx ON commission_entries (organization_id, seller_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_events_org_created_idx ON audit_events (organization_id, created_at);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON audit_events (organization_id, entity_type, entity_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_org_fk') THEN ALTER TABLE products ADD CONSTRAINT products_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_org_fk') THEN ALTER TABLE sales ADD CONSTRAINT sales_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_contact_fk') THEN ALTER TABLE sales ADD CONSTRAINT sales_contact_fk FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_owner_fk') THEN ALTER TABLE sales ADD CONSTRAINT sales_owner_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_org_fk') THEN ALTER TABLE sale_items ADD CONSTRAINT sale_items_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_sale_fk') THEN ALTER TABLE sale_items ADD CONSTRAINT sale_items_sale_fk FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_org_fk') THEN ALTER TABLE contracts ADD CONSTRAINT contracts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_org_fk') THEN ALTER TABLE goals ADD CONSTRAINT goals_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_plans_org_fk') THEN ALTER TABLE commission_plans ADD CONSTRAINT commission_plans_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_rules_plan_fk') THEN ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_plan_fk FOREIGN KEY (plan_id) REFERENCES commission_plans(id) ON DELETE CASCADE; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commission_entries_org_fk') THEN ALTER TABLE commission_entries ADD CONSTRAINT commission_entries_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_events_org_fk') THEN ALTER TABLE audit_events ADD CONSTRAINT audit_events_org_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT; END IF;
END $$;
