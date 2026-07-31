-- Many-to-many task assignments.
-- Allows multiple employees to be assigned to the same task.
-- Backfills from existing assigned_to and assigned_employee_id columns.

CREATE TABLE IF NOT EXISTS task_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(task_id, profile_id)
);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'task_assignments' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY anon_all ON task_assignments
      FOR ALL TO anon
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Backfill from existing assigned_to column
INSERT INTO task_assignments (task_id, profile_id)
SELECT t.id, t.assigned_to
FROM tasks t
WHERE t.assigned_to IS NOT NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.assigned_to)
ON CONFLICT (task_id, profile_id) DO NOTHING;

-- Also backfill from assigned_employee_id if different
INSERT INTO task_assignments (task_id, profile_id)
SELECT t.id, t.assigned_employee_id
FROM tasks t
WHERE t.assigned_employee_id IS NOT NULL
  AND (t.assigned_to IS NULL OR t.assigned_employee_id != t.assigned_to)
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = t.assigned_employee_id)
ON CONFLICT (task_id, profile_id) DO NOTHING;
