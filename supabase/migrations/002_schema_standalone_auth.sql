-- Upper Construction — Schema sem dependência do Supabase Auth
-- Rode este arquivo no SQL Editor do Supabase Dashboard
-- (Project: oyllangxcsvxcpdilzga)

create extension if not exists "pgcrypto";

-- COMPANIES
create table if not exists companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,
  language    text not null default 'pt' check (language in ('en', 'pt', 'es')),
  created_at  timestamptz not null default now()
);

-- PROFILES
create table if not exists profiles (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid references companies(id) on delete cascade,
  role         text not null default 'employee' check (role in ('admin', 'employee')),
  full_name    text not null,
  email        text unique not null,
  position     text,
  hourly_rate  numeric(10,2) not null default 0,
  avatar_url   text,
  phone        text,
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- PROJECTS
create table if not exists projects (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid references companies(id) on delete cascade,
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
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- TASKS
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade,
  assigned_to  uuid references profiles(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  progress     int not null default 0 check (progress >= 0 and progress <= 100),
  due_date     date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- TIME ENTRIES (hours_worked calculado automaticamente)
create table if not exists time_entries (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid references profiles(id) on delete cascade,
  project_id       uuid references projects(id) on delete set null,
  company_id       uuid references companies(id) on delete cascade,
  clock_in         timestamptz not null,
  clock_out        timestamptz,
  hours_worked     numeric(6,2) generated always as (
    case when clock_out is not null
    then round(extract(epoch from (clock_out - clock_in)) / 3600, 2)
    else null end
  ) stored,
  is_manual_entry  boolean not null default false,
  notes            text,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- PAYROLL RECORDS
create table if not exists payroll_records (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid references profiles(id) on delete cascade,
  company_id    uuid references companies(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  total_hours   numeric(8,2) not null default 0,
  hourly_rate   numeric(10,2) not null default 0,
  total_amount  numeric(12,2) not null default 0,
  status        text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);

-- PROJECT PHOTOS
create table if not exists project_photos (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade,
  company_id    uuid references companies(id) on delete cascade,
  uploaded_by   uuid references profiles(id) on delete set null,
  storage_path  text not null,
  tag           text not null default 'progress' check (tag in ('before', 'progress', 'after')),
  caption       text,
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

-- REPORTS
create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade,
  company_id    uuid references companies(id) on delete cascade,
  generated_by  uuid references profiles(id) on delete set null,
  storage_path  text,
  sent_to_email text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- UPDATED_AT triggers
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated_at  before update on profiles  for each row execute function update_updated_at();
create trigger trg_projects_updated_at  before update on projects  for each row execute function update_updated_at();
create trigger trg_tasks_updated_at     before update on tasks     for each row execute function update_updated_at();

-- INDEXES
create index if not exists idx_profiles_company          on profiles(company_id);
create index if not exists idx_projects_company          on projects(company_id);
create index if not exists idx_time_entries_employee     on time_entries(employee_id);
create index if not exists idx_time_entries_company_date on time_entries(company_id, clock_in desc);
create index if not exists idx_payroll_employee          on payroll_records(employee_id);

-- RLS: habilitado mas com acesso total para a anon key
-- (autenticação é feita via JWT cookie próprio, não Supabase Auth)
alter table companies       enable row level security;
alter table profiles        enable row level security;
alter table projects        enable row level security;
alter table tasks           enable row level security;
alter table time_entries    enable row level security;
alter table payroll_records enable row level security;
alter table project_photos  enable row level security;
alter table reports         enable row level security;

create policy "anon_all" on companies       for all to anon using (true) with check (true);
create policy "anon_all" on profiles        for all to anon using (true) with check (true);
create policy "anon_all" on projects        for all to anon using (true) with check (true);
create policy "anon_all" on tasks           for all to anon using (true) with check (true);
create policy "anon_all" on time_entries    for all to anon using (true) with check (true);
create policy "anon_all" on payroll_records for all to anon using (true) with check (true);
create policy "anon_all" on project_photos  for all to anon using (true) with check (true);
create policy "anon_all" on reports         for all to anon using (true) with check (true);

-- SEED: empresa e admin inicial
insert into companies (id, name, language) values
  ('00000000-0000-0000-0000-000000000001', 'Upper Construction', 'pt')
on conflict do nothing;

insert into profiles (company_id, role, full_name, email, status) values
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Tiago (Admin)', 'admin@upperconstruction.com', 'active')
on conflict (email) do nothing;
