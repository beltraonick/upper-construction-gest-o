-- Profile page: notification preference. avatar_url, phone, and
-- language already exist on profiles from earlier migrations.
-- Safe to run multiple times.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;
