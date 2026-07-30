-- Creates per-project Kanban columns and links tasks to them.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS task_columns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL,
  name         text NOT NULL,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_columns' AND column_name = 'id'
  ) THEN
    -- table was just created, nothing to do
    NULL;
  END IF;
END $$;

-- Grant anon full access (same pattern as every other table in this app)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_columns' AND policyname = 'anon_all_task_columns'
  ) THEN
    ALTER TABLE task_columns ENABLE ROW LEVEL SECURITY;
    CREATE POLICY anon_all_task_columns ON task_columns FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Add column_id to tasks (nullable so existing tasks keep working)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS column_id uuid REFERENCES task_columns(id) ON DELETE SET NULL;
