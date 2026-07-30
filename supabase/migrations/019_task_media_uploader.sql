-- Store uploader name directly on task_media for photo attribution display
ALTER TABLE task_media ADD COLUMN IF NOT EXISTS uploaded_by_name text;
