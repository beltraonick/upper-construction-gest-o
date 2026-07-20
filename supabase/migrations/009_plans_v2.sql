-- Pricing v2 — replaces the 2-tier placeholder from migration 006/007
-- with the 3-tier structure decided with the co-founder: Free / Starter
-- ($49) / Growth ($99). Schema only — still no Stripe wiring and no
-- app code enforces these limits yet (see migration 006's note on why:
-- depends on companies being resolved dynamically per user instead of
-- the hardcoded single-company constant used everywhere today).

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS admin_limit integer,               -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS employee_limit integer,             -- NULL = unlimited
  ADD COLUMN IF NOT EXISTS client_limit integer,                -- NULL = unlimited (all plans, by design)
  ADD COLUMN IF NOT EXISTS photos_unlimited boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS video_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_notes_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_portal_tier text NOT NULL DEFAULT 'basic'
    CHECK (client_portal_tier IN ('basic', 'full')),
  ADD COLUMN IF NOT EXISTS ai_tier text NOT NULL DEFAULT 'limited'
    CHECK (ai_tier IN ('limited', 'full')),
  ADD COLUMN IF NOT EXISTS pdf_reports_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_dashboard_tier text NOT NULL DEFAULT 'basic'
    CHECK (admin_dashboard_tier IN ('basic', 'full')),
  ADD COLUMN IF NOT EXISTS offline_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_tier text NOT NULL DEFAULT 'community'
    CHECK (support_tier IN ('community', 'email', 'priority')),
  ADD COLUMN IF NOT EXISTS is_popular boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extra_features text[] NOT NULL DEFAULT '{}';

-- Free — new tier, didn't exist before
INSERT INTO plans (
  key, name, price_cents, project_limit, admin_limit, employee_limit, client_limit,
  photos_unlimited, video_enabled, voice_notes_enabled, client_portal_tier, ai_tier,
  pdf_reports_enabled, admin_dashboard_tier, offline_enabled, support_tier, is_popular
) VALUES (
  'free', 'Free', 0, 4, 1, 3, NULL,
  false, false, false, 'basic', 'limited',
  false, 'basic', false, 'community', false
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, price_cents = EXCLUDED.price_cents, project_limit = EXCLUDED.project_limit,
  admin_limit = EXCLUDED.admin_limit, employee_limit = EXCLUDED.employee_limit, client_limit = EXCLUDED.client_limit,
  photos_unlimited = EXCLUDED.photos_unlimited, video_enabled = EXCLUDED.video_enabled,
  voice_notes_enabled = EXCLUDED.voice_notes_enabled, client_portal_tier = EXCLUDED.client_portal_tier,
  ai_tier = EXCLUDED.ai_tier, pdf_reports_enabled = EXCLUDED.pdf_reports_enabled,
  admin_dashboard_tier = EXCLUDED.admin_dashboard_tier, offline_enabled = EXCLUDED.offline_enabled,
  support_tier = EXCLUDED.support_tier, is_popular = EXCLUDED.is_popular;

-- Starter — was $50/6 projects, now $49/unlimited projects, "Most Popular"
INSERT INTO plans (
  key, name, price_cents, project_limit, admin_limit, employee_limit, client_limit,
  photos_unlimited, video_enabled, voice_notes_enabled, client_portal_tier, ai_tier,
  pdf_reports_enabled, admin_dashboard_tier, offline_enabled, support_tier, is_popular
) VALUES (
  'starter', 'Starter', 4900, NULL, 2, 15, NULL,
  true, true, true, 'full', 'full',
  true, 'full', true, 'email', true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, price_cents = EXCLUDED.price_cents, project_limit = EXCLUDED.project_limit,
  admin_limit = EXCLUDED.admin_limit, employee_limit = EXCLUDED.employee_limit, client_limit = EXCLUDED.client_limit,
  photos_unlimited = EXCLUDED.photos_unlimited, video_enabled = EXCLUDED.video_enabled,
  voice_notes_enabled = EXCLUDED.voice_notes_enabled, client_portal_tier = EXCLUDED.client_portal_tier,
  ai_tier = EXCLUDED.ai_tier, pdf_reports_enabled = EXCLUDED.pdf_reports_enabled,
  admin_dashboard_tier = EXCLUDED.admin_dashboard_tier, offline_enabled = EXCLUDED.offline_enabled,
  support_tier = EXCLUDED.support_tier, is_popular = EXCLUDED.is_popular;

-- Growth — price unchanged ($99), now explicitly unlimited projects + higher admin/employee caps
INSERT INTO plans (
  key, name, price_cents, project_limit, admin_limit, employee_limit, client_limit,
  photos_unlimited, video_enabled, voice_notes_enabled, client_portal_tier, ai_tier,
  pdf_reports_enabled, admin_dashboard_tier, offline_enabled, support_tier, is_popular, extra_features
) VALUES (
  'growth', 'Growth', 9900, NULL, 5, 50, NULL,
  true, true, true, 'full', 'full',
  true, 'full', true, 'priority', false,
  ARRAY['Advanced permissions', 'Analytics', 'Future integrations']
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, price_cents = EXCLUDED.price_cents, project_limit = EXCLUDED.project_limit,
  admin_limit = EXCLUDED.admin_limit, employee_limit = EXCLUDED.employee_limit, client_limit = EXCLUDED.client_limit,
  photos_unlimited = EXCLUDED.photos_unlimited, video_enabled = EXCLUDED.video_enabled,
  voice_notes_enabled = EXCLUDED.voice_notes_enabled, client_portal_tier = EXCLUDED.client_portal_tier,
  ai_tier = EXCLUDED.ai_tier, pdf_reports_enabled = EXCLUDED.pdf_reports_enabled,
  admin_dashboard_tier = EXCLUDED.admin_dashboard_tier, offline_enabled = EXCLUDED.offline_enabled,
  support_tier = EXCLUDED.support_tier, is_popular = EXCLUDED.is_popular, extra_features = EXCLUDED.extra_features;
