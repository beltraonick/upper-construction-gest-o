-- Migration 004 — Project Plans, Markers, and Task Photo Requirements
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards everywhere)
-- MANUAL SETUP REQUIRED: Create storage buckets 'plans' and 'task-photos' in Supabase Dashboard
--   Storage > New bucket > Name: plans, Public: true
--   Storage > New bucket > Name: task-photos, Public: true

-- ============================================================
-- TASKS — add photo requirement flags and plan position
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS before_photo_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS after_photo_required  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_x_pct            numeric,
  ADD COLUMN IF NOT EXISTS plan_y_pct            numeric;

-- ============================================================
-- TASK MEDIA — add photo category (before | progress | after)
-- ============================================================
ALTER TABLE task_media
  ADD COLUMN IF NOT EXISTS photo_category text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_media_photo_category_check'
  ) THEN
    ALTER TABLE task_media
      ADD CONSTRAINT task_media_photo_category_check
      CHECK (photo_category IN ('before', 'progress', 'after'));
  END IF;
END $$;

-- ============================================================
-- PROJECT PLANS (one plan doc per upload, may have many sheets)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  version     int  NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_plans_project_id_idx ON project_plans(project_id);
CREATE INDEX IF NOT EXISTS project_plans_company_id_idx ON project_plans(company_id);

ALTER TABLE project_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'project_plans' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON project_plans FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- PLAN SHEETS (one image per sheet/page)
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_sheets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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
    CREATE POLICY "anon_all" ON plan_sheets FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- PLAN MARKERS (clickable pins on a plan sheet)
-- ============================================================
CREATE TABLE IF NOT EXISTS plan_markers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id    uuid NOT NULL REFERENCES plan_sheets(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  marker_type text NOT NULL DEFAULT 'task' CHECK (marker_type IN ('task', 'note', 'photo')),
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
    CREATE POLICY "anon_all" ON plan_markers FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- TASKS — add FK to plan_sheets (after plan_sheets exists)
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS plan_sheet_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_plan_sheet_id_fk'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_plan_sheet_id_fk
      FOREIGN KEY (plan_sheet_id) REFERENCES plan_sheets(id) ON DELETE SET NULL;
  END IF;
END $$;
