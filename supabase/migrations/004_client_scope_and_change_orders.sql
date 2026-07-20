-- Client portal scoping + change orders (extras)
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards everywhere)

-- ============================================================
-- PROJECTS — document columns that already exist in production
-- but were never captured in a migration file (added by hand
-- via the Supabase dashboard). Adding them here with IF NOT
-- EXISTS keeps this file a truthful copy of the real schema
-- without touching data that already exists.
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS hotel_name text,
  ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget numeric(12,2);

-- ============================================================
-- CHANGE ORDERS (extras) — work the client needs to approve
-- before it's billed/added to the project.
-- ============================================================
CREATE TABLE IF NOT EXISTS change_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text,
  amount         numeric(12,2) NOT NULL DEFAULT 0,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  client_comment text,
  created_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS change_orders_project_id_idx ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS change_orders_company_id_idx ON change_orders(company_id);
CREATE INDEX IF NOT EXISTS change_orders_status_idx ON change_orders(status);

DROP TRIGGER IF EXISTS trg_change_orders_updated_at ON change_orders;
CREATE TRIGGER trg_change_orders_updated_at
  BEFORE UPDATE ON change_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'change_orders' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON change_orders FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
