-- Orbit V1.0 — extend existing schema for tasks, projects, feed, and media
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards everywhere)

-- ============================================================
-- TASKS — add missing columns to existing table
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

-- Drop old status constraint and replace with one that includes 'blocked' and 'urgent'
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending','in_progress','completed','blocked'));

-- Drop old priority check if it was added previously
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('low','medium','high','urgent'));

-- Backfill company_id for existing rows
UPDATE tasks SET company_id = '00000000-0000-0000-0000-000000000001'
  WHERE company_id IS NULL;

-- Copy assigned_to → assigned_employee_id for existing rows
UPDATE tasks SET assigned_employee_id = assigned_to
  WHERE assigned_employee_id IS NULL AND assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_company_id_idx ON tasks(company_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_employee_id_idx ON tasks(assigned_employee_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);

-- RLS: allow anon (standalone auth pattern used by this app)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON tasks FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- PROJECTS — add missing columns
-- ============================================================
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================
-- PROJECT FEED
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

CREATE INDEX IF NOT EXISTS project_feed_project_id_idx ON project_feed(project_id);
CREATE INDEX IF NOT EXISTS project_feed_company_id_idx ON project_feed(company_id);

ALTER TABLE project_feed ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_feed' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON project_feed FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TASK MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS task_media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid REFERENCES tasks(id) ON DELETE CASCADE,
  project_id   uuid REFERENCES projects(id) ON DELETE SET NULL,
  employee_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  media_type   text NOT NULL CHECK (media_type IN ('photo','video','voice')),
  storage_path text NOT NULL,
  transcription text,
  caption      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_media_task_id_idx ON task_media(task_id);
CREATE INDEX IF NOT EXISTS task_media_company_id_idx ON task_media(company_id);

ALTER TABLE task_media ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_media' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON task_media FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- PROFILES — allow 'client' role (extend check constraint)
-- ============================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','employee','client'));

-- Seed demo task
INSERT INTO tasks (company_id, title, description, priority, status, area)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Inspect foundation on Block A',
  'Check structural integrity and document any cracks or water damage.',
  'high',
  'pending',
  'Block A – Ground Floor'
) ON CONFLICT DO NOTHING;
