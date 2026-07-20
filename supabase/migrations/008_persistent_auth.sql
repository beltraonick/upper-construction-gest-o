-- Persistent login: profiles becomes the real source of truth for
-- credentials instead of the in-memory seed list in lib/auth/store.ts.
-- Safe to run multiple times.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'pt', 'es')),
  ADD COLUMN IF NOT EXISTS auth_status text NOT NULL DEFAULT 'approved'
    CHECK (auth_status IN ('pending', 'approved', 'suspended')),
  -- The Employees admin screen has always had a "Company (subcontractor)"
  -- field, but this column was never actually created — every save from
  -- that screen has been silently failing against the real database.
  ADD COLUMN IF NOT EXISTS company_name text;

-- `status` (active/archived) already tracks employment status and is
-- unrelated to login gating — auth_status is the new, separate gate
-- used specifically to approve/suspend sign-in.

-- Give the seed admin profile (created by migration 002) a real
-- password so login keeps working once this lands: Admin123!
-- (hashed with the app's existing sha256+static-salt scheme).
UPDATE profiles
SET password_hash = '93fa55e219954c4e0f5665fc572fb2e24886428b68fb72ebf0775b2c8da683d8',
    auth_status = 'approved'
WHERE email = 'admin@upperconstruction.com' AND password_hash IS NULL;

