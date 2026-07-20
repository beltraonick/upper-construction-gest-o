-- Room/floor grid (item 2) + photos attached directly to a task (item 3)
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards everywhere)

-- ============================================================
-- PROJECT ROOMS — lightweight location grid, no blueprint needed.
-- A room's status is derived from the tasks linked to it (not
-- stored), so it never goes stale.
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_rooms' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON project_rooms FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Link tasks to a room. Keep the existing free-text `area` column —
-- it's still used as the display label everywhere in the UI, and gets
-- auto-filled from the room's label when a room is picked.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES project_rooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_room_id_idx ON tasks(room_id);

-- ============================================================
-- TASK_MEDIA — RLS was missing an anon policy in migration 003's
-- guard block naming; make sure it's actually there (idempotent).
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_media' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON task_media FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;
