-- Catch-up: applies migrations 004 (plans/markers/task photos) and 012
-- (invite codes / activation / password reset) which were written but
-- never actually run against the live database — that's why the new
-- floor-plan feature and invite-based signup aren't working yet.
-- Also fixes a real gap found in this pass: project_photos.tag was
-- referenced by the project detail page but never existed as a column.
-- Safe to run multiple times, safe to run even if parts already exist.

-- ============================================================
-- From migration 004 — Project Plans, Markers, Task Photo flags
-- MANUAL STEP STILL REQUIRED AFTER THIS: create two Storage buckets
-- in the Supabase Dashboard (Storage → New bucket):
--   name: plans        — Public: ON
--   name: task-photos  — Public: ON
-- ============================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS before_photo_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS after_photo_required  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_x_pct            numeric,
  ADD COLUMN IF NOT EXISTS plan_y_pct            numeric;

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

-- ============================================================
-- Fix found in this pass: project detail page inserts photos with a
-- `tag` value, but that column never existed on this database.
-- ============================================================
ALTER TABLE project_photos
  ADD COLUMN IF NOT EXISTS tag text NOT NULL DEFAULT 'progress';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_photos_tag_check'
  ) THEN
    ALTER TABLE project_photos
      ADD CONSTRAINT project_photos_tag_check
      CHECK (tag IN ('before', 'progress', 'after'));
  END IF;
END $$;

-- ============================================================
-- From migration 012 — invite codes, membership requests,
-- client activations, password resets
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        text NOT NULL,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_code_key ON invite_codes(code);
CREATE INDEX IF NOT EXISTS invite_codes_company_active ON invite_codes(company_id, is_active);

CREATE TABLE IF NOT EXISTS membership_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invite_code_id   uuid REFERENCES invite_codes(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_requests_company_status
  ON membership_requests(company_id, status);
CREATE INDEX IF NOT EXISTS membership_requests_profile
  ON membership_requests(profile_id);

CREATE TABLE IF NOT EXISTS client_activations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_activations_token ON client_activations(token_hash);
CREATE INDEX IF NOT EXISTS client_activations_profile ON client_activations(profile_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS password_resets_profile ON password_resets(profile_id);

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON invite_codes;
CREATE POLICY anon_all ON invite_codes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE membership_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON membership_requests;
CREATE POLICY anon_all ON membership_requests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE client_activations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON client_activations;
CREATE POLICY anon_all ON client_activations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON password_resets;
CREATE POLICY anon_all ON password_resets FOR ALL USING (true) WITH CHECK (true);
