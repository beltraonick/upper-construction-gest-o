-- Flexible permission toggles for employees (e.g. "Supervisor" extra powers).
-- Stored as jsonb so new permission keys can be added later without a migration.
-- Known keys: checkin_team, delete_team_photos, create_extras, close_payroll.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;
