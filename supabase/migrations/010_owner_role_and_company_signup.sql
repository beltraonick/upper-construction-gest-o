-- Platform owner role (Nexy's view across every company) + groundwork
-- for the new-company signup flow. Safe to run multiple times.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','employee','client','owner'));

-- profiles.company_id has always been nullable — an owner isn't scoped
-- to any single company, so no schema change needed there.

-- Seed one owner account (email from the account this workspace runs
-- under). Temporary password below — change it after first login.
-- Owner123!
INSERT INTO profiles (company_id, role, full_name, email, status, auth_status, password_hash, language)
VALUES (
  NULL, 'owner', 'Nexy (Platform Owner)', 'somosnexy@gmail.com', 'active', 'approved',
  '261b4a19b948238cfcf555a136d479f6da486c0f259cdeaabbe8236ea3a7d366', 'pt'
)
ON CONFLICT (email) DO UPDATE SET role = 'owner', auth_status = 'approved';
