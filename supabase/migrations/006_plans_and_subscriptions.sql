-- Multi-tenant billing groundwork (schema only — no Stripe wiring yet,
-- and no app code reads these columns yet: that lands once persistent
-- auth resolves company_id dynamically instead of the hardcoded
-- single-company constant used throughout the app today).
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards everywhere)

CREATE TABLE IF NOT EXISTS plans (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text UNIQUE NOT NULL,
  name          text NOT NULL,
  price_cents   integer NOT NULL,
  project_limit integer,  -- NULL = unlimited
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'plans' AND policyname = 'anon_all'
  ) THEN
    CREATE POLICY "anon_all" ON plans FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed the two plans discussed: Starter ($50/mo, up to 6 projects)
-- and Growth ($99/mo, unlimited projects). Prices/limits are easy to
-- tweak later — this is just the starting point.
INSERT INTO plans (key, name, price_cents, project_limit) VALUES
  ('starter', 'Starter', 5000, 6),
  ('growth',  'Growth',  9900, NULL)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- COMPANIES — subscription state per tenant
-- ============================================================
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Existing company (CAA / Upper Construction) starts on Growth, active —
-- they're the pilot customer, not a trial.
UPDATE companies
SET plan_id = (SELECT id FROM plans WHERE key = 'growth'),
    subscription_status = 'active'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND plan_id IS NULL;
