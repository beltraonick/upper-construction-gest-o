-- Fix project_plans schema conflict between migration 011 (old design:
-- label + storage_path required) and 013 (new design: name column, sheets
-- stored in plan_sheets). Migration 013's CREATE TABLE IF NOT EXISTS was a
-- no-op when 011 had already created the table, leaving the wrong schema.

-- 1. Add `name` column (app inserts with name, not label)
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS name text;
UPDATE project_plans SET name = label WHERE name IS NULL;
UPDATE project_plans SET name = 'Floor Plan' WHERE name IS NULL;

-- 2. Make storage_path nullable (old schema had it NOT NULL; new design
--    stores paths on plan_sheets, not on project_plans)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_plans' AND column_name = 'storage_path'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE project_plans ALTER COLUMN storage_path DROP NOT NULL;
  END IF;
END $$;

-- 3. Add version column
ALTER TABLE project_plans ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

-- 4. plan_sheets (created in 013 but only if 013 ran after 011 on a clean DB;
--    safe to run again — IF NOT EXISTS guards it)
CREATE TABLE IF NOT EXISTS plan_sheets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES projects(id)      ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id)     ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_type    text NOT NULL DEFAULT 'image',
  page_number  int  NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_sheets_plan_id_idx ON plan_sheets(plan_id);

ALTER TABLE plan_sheets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plan_sheets' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON plan_sheets FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. plan_markers
CREATE TABLE IF NOT EXISTS plan_markers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id    uuid NOT NULL REFERENCES plan_sheets(id)   ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id)      ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id)     ON DELETE CASCADE,
  marker_type text NOT NULL DEFAULT 'task'
              CHECK (marker_type IN ('task', 'note', 'photo')),
  title       text NOT NULL,
  description text,
  x_pct       numeric NOT NULL,
  y_pct       numeric NOT NULL,
  task_id     uuid REFERENCES tasks(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_markers_sheet_id_idx ON plan_markers(sheet_id);
CREATE INDEX IF NOT EXISTS plan_markers_task_id_idx  ON plan_markers(task_id);

ALTER TABLE plan_markers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plan_markers' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON plan_markers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Tasks columns for plan pins
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS plan_sheet_id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS plan_x_pct    numeric;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS plan_y_pct    numeric;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_plan_sheet_id_fk'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_plan_sheet_id_fk
      FOREIGN KEY (plan_sheet_id) REFERENCES plan_sheets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- MANUAL STEP: Make sure the 'plans' storage bucket exists in Supabase Dashboard
-- Storage → New bucket → name: plans  — set Public: ON
-- Storage → New bucket → name: project-photos  — set Public: ON
