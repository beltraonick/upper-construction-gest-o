-- QuickBooks Online integration tables (time tracking only)
-- Orbit is always the source of truth; QBO is a sync destination only.

-- One QBO connection per company
CREATE TABLE IF NOT EXISTS qbo_connections (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  realm_id         text NOT NULL,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  token_expires_at  timestamptz NOT NULL,
  connected_at      timestamptz DEFAULT now(),
  connected_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active         boolean DEFAULT true,
  UNIQUE(company_id)
);

ALTER TABLE qbo_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'qbo_connections' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY anon_all ON qbo_connections FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Profile → QBO Employee ID mapping
CREATE TABLE IF NOT EXISTS qbo_employee_map (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  qbo_employee_id   text NOT NULL,
  qbo_employee_name text,
  mapped_at         timestamptz DEFAULT now(),
  UNIQUE(company_id, profile_id)
);

ALTER TABLE qbo_employee_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'qbo_employee_map' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY anon_all ON qbo_employee_map FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Audit log for every sync attempt
CREATE TABLE IF NOT EXISTS qbo_sync_log (
  id                      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id              uuid NOT NULL,
  time_entry_id           uuid REFERENCES time_entries(id) ON DELETE SET NULL,
  qbo_time_activity_id    text,
  status                  text NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  error_message           text,
  attempted_at            timestamptz DEFAULT now(),
  synced_at               timestamptz
);

ALTER TABLE qbo_sync_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'qbo_sync_log' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY anon_all ON qbo_sync_log FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Track QBO sync state on each time entry
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS qbo_time_activity_id text,
  ADD COLUMN IF NOT EXISTS qbo_sync_status text DEFAULT 'not_synced';
