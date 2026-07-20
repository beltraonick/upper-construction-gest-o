-- Real floor plans with pins (Fieldwire-style), as a per-project add-on
-- alongside the room grid — neither replaces the other. Safe to run
-- multiple times.

CREATE TABLE IF NOT EXISTS project_plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  label         text NOT NULL DEFAULT 'Floor Plan',
  storage_path  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_plans_project_id_idx ON project_plans(project_id);
CREATE INDEX IF NOT EXISTS project_plans_company_id_idx ON project_plans(company_id);

ALTER TABLE project_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_plans' AND policyname = 'anon_all') THEN
    CREATE POLICY "anon_all" ON project_plans FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Pin a task to an exact spot on a plan image. pin_x / pin_y are
-- fractions (0.0-1.0) of the image's width/height, so the pin lands in
-- the same place regardless of what size the image is displayed at.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES project_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pin_x numeric,
  ADD COLUMN IF NOT EXISTS pin_y numeric;

CREATE INDEX IF NOT EXISTS tasks_plan_id_idx ON tasks(plan_id);
