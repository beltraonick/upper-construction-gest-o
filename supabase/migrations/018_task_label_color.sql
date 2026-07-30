-- Add color label to tasks for visual organization
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS label_color text;
