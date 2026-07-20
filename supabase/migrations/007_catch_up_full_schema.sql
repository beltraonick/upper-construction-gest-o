-- Catch-up migration: brings the live database up to date with
-- everything the app code expects. Safe to run in one shot, safe to
-- re-run — every statement is guarded (IF NOT EXISTS / DO blocks).
-- Supersedes running 002-006 individually.

-- ============================================================
-- Missing base tables (never created — app code assumed they existed)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  progress     int NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  due_date     date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid REFERENCES projects(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  generated_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  storage_path  text,
  sent_to_email text,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON tasks FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reports' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON reports FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PROJECTS — client_email / client_phone were in the original design
-- but never actually applied to this database.
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS hotel_name text,
  ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget numeric(12,2);

-- ============================================================
-- TASKS — extended columns (checklist, priority, area, etc.)
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS estimated_hours numeric,
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_employee_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending','in_progress','completed','blocked'));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('low','medium','high','urgent'));

UPDATE tasks SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE tasks SET assigned_employee_id = assigned_to WHERE assigned_employee_id IS NULL AND assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_company_id_idx ON tasks(company_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_employee_id_idx ON tasks(assigned_employee_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);

-- ============================================================
-- PROJECT FEED / TASK MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS project_feed (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  description text NOT NULL,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid REFERENCES tasks(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  employee_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  media_type    text NOT NULL CHECK (media_type IN ('photo','video','voice')),
  storage_path  text NOT NULL,
  transcription text,
  caption       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE project_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_media ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_feed' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON project_feed FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'task_media' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON task_media FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- PROFILES — allow 'client' role
-- ============================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','employee','client'));

-- ============================================================
-- CHANGE ORDERS
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

ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_change_orders_updated_at ON change_orders;
CREATE TRIGGER trg_change_orders_updated_at BEFORE UPDATE ON change_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'change_orders' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON change_orders FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- PROJECT ROOMS
-- ============================================================
CREATE TABLE IF NOT EXISTS project_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  floor       text,
  label       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_rooms_project_id_idx ON project_rooms(project_id);
CREATE INDEX IF NOT EXISTS project_rooms_company_id_idx ON project_rooms(company_id);

ALTER TABLE project_rooms ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_rooms' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON project_rooms FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES project_rooms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_room_id_idx ON tasks(room_id);

-- ============================================================
-- PLANS / SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,
  name          text NOT NULL,
  price_cents   integer NOT NULL,
  project_limit integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON plans FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO plans (key, name, price_cents, project_limit) VALUES
  ('starter', 'Starter', 5000, 6),
  ('growth',  'Growth',  9900, NULL)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

UPDATE companies
SET plan_id = (SELECT id FROM plans WHERE key = 'growth'),
    subscription_status = 'active'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND plan_id IS NULL;

-- ============================================================
-- SEED demo task (only if tasks table was just created empty)
-- ============================================================
INSERT INTO tasks (company_id, title, description, priority, status, area)
SELECT '00000000-0000-0000-0000-000000000001', 'Inspect foundation on Block A',
       'Check structural integrity and document any cracks or water damage.',
       'high', 'pending', 'Block A – Ground Floor'
WHERE NOT EXISTS (SELECT 1 FROM tasks);
