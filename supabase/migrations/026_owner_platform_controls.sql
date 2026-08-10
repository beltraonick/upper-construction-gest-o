-- Adds what the platform owner panel (hidden /adminnovarkadmin login,
-- owner-role dashboard) needs to track: last time each account logged in,
-- and manual billing tracking per company (no payment gateway wired up
-- yet, so this is tracked by hand for now).
-- Safe to run multiple times (IF NOT EXISTS guards everywhere).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS months_overdue integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_notes text;
