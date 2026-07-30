-- Add cover image path to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image_path text;
