-- Auth & Access System: invite codes, membership requests,
-- client activations, and password resets.
-- Safe to run multiple times (IF NOT EXISTS throughout).

-- ── invite_codes ───────────────────────────────────────────────────────
-- One active code per company. Admin can regenerate (deactivates old).
CREATE TABLE IF NOT EXISTS invite_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code        text NOT NULL,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_code_key ON invite_codes(code);
CREATE INDEX IF NOT EXISTS invite_codes_company_active ON invite_codes(company_id, is_active);

-- ── membership_requests ────────────────────────────────────────────────
-- Created when an employee registers with an invite code.
-- Pending until admin approves or rejects.
CREATE TABLE IF NOT EXISTS membership_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invite_code_id   uuid REFERENCES invite_codes(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_requests_company_status
  ON membership_requests(company_id, status);
CREATE INDEX IF NOT EXISTS membership_requests_profile
  ON membership_requests(profile_id);

-- ── client_activations ────────────────────────────────────────────────
-- One-time token so admin-created clients can set their password.
CREATE TABLE IF NOT EXISTS client_activations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS client_activations_token ON client_activations(token_hash);
CREATE INDEX IF NOT EXISTS client_activations_profile ON client_activations(profile_id);

-- ── password_resets ───────────────────────────────────────────────────
-- One-time token for self-service password recovery.
CREATE TABLE IF NOT EXISTS password_resets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash   text NOT NULL,
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS password_resets_profile ON password_resets(profile_id);

-- ── RLS: open policies (security enforced at app layer) ───────────────
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON invite_codes;
CREATE POLICY anon_all ON invite_codes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE membership_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON membership_requests;
CREATE POLICY anon_all ON membership_requests FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE client_activations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON client_activations;
CREATE POLICY anon_all ON client_activations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON password_resets;
CREATE POLICY anon_all ON password_resets FOR ALL USING (true) WITH CHECK (true);

-- ── Seed: dev company (used by in-memory test accounts) ───────────────
-- Allows invite_codes to be created for admin@orbit.test during testing.
INSERT INTO companies (id, name, language)
VALUES ('00000000-0000-0000-0000-000000000001', 'Orbit Dev Company', 'en')
ON CONFLICT (id) DO NOTHING;
