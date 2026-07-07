-- Upper Construction Management Platform
-- Initial Schema

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- COMPANIES (multi-tenant foundation)
-- ============================================================
create table companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,
  language    text not null default 'en' check (language in ('en', 'pt', 'es')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PROFILES (extends Supabase Auth users)
-- ============================================================
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  company_id   uuid not null references companies(id) on delete cascade,
  role         text not null check (role in ('admin', 'employee')),
  full_name    text not null,
  position     text,
  hourly_rate  numeric(10,2) not null default 0,
  avatar_url   text,
  phone        text,
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- PROJECTS
-- ============================================================
create table projects (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  name           text not null,
  client_name    text,
  client_email   text,
  client_phone   text,
  address        text,
  description    text,
  progress       int not null default 0 check (progress >= 0 and progress <= 100),
  status         text not null default 'active' check (status in ('active', 'on_hold', 'completed', 'cancelled')),
  start_date     date,
  end_date       date,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- PROJECT <-> EMPLOYEE assignments
-- ============================================================
create table project_employees (
  project_id   uuid not null references projects(id) on delete cascade,
  employee_id  uuid not null references profiles(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  primary key (project_id, employee_id)
);

-- ============================================================
-- TASKS
-- ============================================================
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  assigned_to  uuid references profiles(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  progress     int not null default 0 check (progress >= 0 and progress <= 100),
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- TIME ENTRIES
-- ============================================================
create table time_entries (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references profiles(id) on delete cascade,
  project_id       uuid references projects(id) on delete set null,
  company_id       uuid not null references companies(id) on delete cascade,
  clock_in         timestamptz not null,
  clock_out        timestamptz,
  hours_worked     numeric(6,2) generated always as (
    case when clock_out is not null
    then extract(epoch from (clock_out - clock_in)) / 3600
    else null end
  ) stored,
  is_manual_entry  boolean not null default false,
  notes            text,
  created_by       uuid references profiles(id),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- PAYROLL RECORDS
-- ============================================================
create table payroll_records (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references profiles(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  total_hours   numeric(8,2) not null default 0,
  hourly_rate   numeric(10,2) not null,
  total_amount  numeric(12,2) not null,
  status        text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- PROJECT PHOTOS
-- ============================================================
create table project_photos (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  uploaded_by   uuid references profiles(id) on delete set null,
  storage_path  text not null,
  tag           text not null check (tag in ('before', 'progress', 'after')),
  caption       text,
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- REPORTS (generated PDF records)
-- ============================================================
create table reports (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  generated_by  uuid references profiles(id) on delete set null,
  storage_path  text,
  sent_to_email text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table companies         enable row level security;
alter table profiles          enable row level security;
alter table projects          enable row level security;
alter table project_employees enable row level security;
alter table tasks             enable row level security;
alter table time_entries      enable row level security;
alter table payroll_records   enable row level security;
alter table project_photos    enable row level security;
alter table reports           enable row level security;

-- Helper: get the authenticated user's company_id
create or replace function auth_company_id()
returns uuid language sql security definer stable as $$
  select company_id from profiles where id = auth.uid()
$$;

-- Helper: check if current user is admin
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists(
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- COMPANIES: only members of that company
create policy "company_members" on companies
  for select using (id = auth_company_id());

-- PROFILES: members see everyone in their company; only admins can mutate
create policy "profiles_select" on profiles
  for select using (company_id = auth_company_id());

create policy "profiles_insert" on profiles
  for insert with check (is_admin() and company_id = auth_company_id());

create policy "profiles_update" on profiles
  for update using (
    is_admin() or id = auth.uid()
  );

create policy "profiles_delete" on profiles
  for delete using (is_admin() and company_id = auth_company_id());

-- PROJECTS
create policy "projects_select" on projects
  for select using (company_id = auth_company_id());

create policy "projects_insert" on projects
  for insert with check (is_admin() and company_id = auth_company_id());

create policy "projects_update" on projects
  for update using (is_admin() and company_id = auth_company_id());

create policy "projects_delete" on projects
  for delete using (is_admin() and company_id = auth_company_id());

-- PROJECT_EMPLOYEES
create policy "project_employees_select" on project_employees
  for select using (
    exists(
      select 1 from projects p
      where p.id = project_id and p.company_id = auth_company_id()
    )
  );

create policy "project_employees_mutate" on project_employees
  for all using (is_admin());

-- TASKS: employees see only their own tasks; admins see all
create policy "tasks_select" on tasks
  for select using (
    exists(select 1 from projects p where p.id = project_id and p.company_id = auth_company_id())
    and (is_admin() or assigned_to = auth.uid())
  );

create policy "tasks_mutate" on tasks
  for all using (is_admin());

create policy "tasks_employee_update" on tasks
  for update using (assigned_to = auth.uid());

-- TIME ENTRIES: employees see own; admins see all in company
create policy "time_entries_select" on time_entries
  for select using (
    company_id = auth_company_id()
    and (is_admin() or employee_id = auth.uid())
  );

create policy "time_entries_insert" on time_entries
  for insert with check (
    company_id = auth_company_id()
    and (is_admin() or employee_id = auth.uid())
  );

create policy "time_entries_update" on time_entries
  for update using (is_admin());

create policy "time_entries_delete" on time_entries
  for delete using (is_admin());

-- PAYROLL: admin only
create policy "payroll_admin" on payroll_records
  for all using (is_admin() and company_id = auth_company_id());

-- PHOTOS: employees can upload to their assigned projects; admins see all
create policy "photos_select" on project_photos
  for select using (company_id = auth_company_id());

create policy "photos_insert" on project_photos
  for insert with check (
    company_id = auth_company_id()
    and (
      is_admin()
      or exists(
        select 1 from project_employees pe
        where pe.project_id = project_id and pe.employee_id = auth.uid()
      )
    )
  );

create policy "photos_delete" on project_photos
  for delete using (is_admin() and company_id = auth_company_id());

-- REPORTS: admin only
create policy "reports_admin" on reports
  for all using (is_admin() and company_id = auth_company_id());

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_profiles_company on profiles(company_id);
create index idx_projects_company on projects(company_id);
create index idx_time_entries_employee on time_entries(employee_id);
create index idx_time_entries_company_date on time_entries(company_id, clock_in desc);
create index idx_payroll_employee on payroll_records(employee_id);
create index idx_photos_project on project_photos(project_id);
