-- Real per-access history so the owner panel can show how many times
-- someone actually opened the app this month, not just a single
-- "last login" timestamp. One row per login (including silent iOS
-- session restores, which represent a genuine app open).
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS login_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_events_profile_created
  ON login_events(profile_id, created_at);

ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON login_events;
CREATE POLICY anon_all ON login_events FOR ALL USING (true) WITH CHECK (true);
