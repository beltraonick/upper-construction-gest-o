-- 028: workers (no-account employees), daily_rate on profiles, supervisor clock-in

-- 1. Add daily_rate to profiles (day-rate model alongside hourly_rate)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_rate numeric(10,2);

-- 2. Workers table — name-only employees with no login account
CREATE TABLE IF NOT EXISTS workers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  full_name   text not null,
  daily_rate  numeric(10,2) not null default 0,
  position    text,
  status      text not null default 'active' check (status in ('active', 'archived')),
  created_at  timestamptz not null default now()
);

-- 3. Worker <-> project assignments
CREATE TABLE IF NOT EXISTS worker_projects (
  worker_id   uuid not null references workers(id) on delete cascade,
  project_id  uuid not null references projects(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  primary key (worker_id, project_id)
);

-- 4. Enhance time_entries for supervisor proxy clock-in
ALTER TABLE time_entries ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS worker_id uuid references workers(id) on delete cascade;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS clocked_by_profile_id uuid references profiles(id) on delete set null;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_full_day boolean;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS approval_status text default 'approved'
  check (approval_status in ('pending', 'approved', 'rejected'));

-- Ensure at least one person reference exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_person_check'
  ) THEN
    ALTER TABLE time_entries ADD CONSTRAINT time_entries_person_check
      CHECK (employee_id IS NOT NULL OR worker_id IS NOT NULL);
  END IF;
END $$;

-- 5. RLS: anon_all on new tables (app handles authorization layer)
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workers' AND policyname='anon_all') THEN
    CREATE POLICY "anon_all" ON workers FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='worker_projects' AND policyname='anon_all') THEN
    CREATE POLICY "anon_all" ON worker_projects FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_workers_company    ON workers(company_id);
CREATE INDEX IF NOT EXISTS idx_worker_projects_project ON worker_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_worker ON time_entries(worker_id);
