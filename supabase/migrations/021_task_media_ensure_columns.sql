-- Ensure task_media has all columns required by the employee photo upload flow.
-- Migration 013 added photo_category and migration 019 added uploaded_by_name,
-- but they may not have been applied on every database. This migration is
-- idempotent — safe to run multiple times.

ALTER TABLE task_media ADD COLUMN IF NOT EXISTS photo_category text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_media_photo_category_check'
  ) THEN
    ALTER TABLE task_media
      ADD CONSTRAINT task_media_photo_category_check
      CHECK (photo_category IN ('before', 'progress', 'after'));
  END IF;
END $$;

ALTER TABLE task_media ADD COLUMN IF NOT EXISTS uploaded_by_name text;
