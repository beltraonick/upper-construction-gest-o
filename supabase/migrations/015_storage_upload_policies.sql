-- Fixes "Upload failed" errors when adding photos/plans from the app.
-- Marking a bucket "Public" in the Storage dashboard only allows public
-- READS (viewing existing files) — it does NOT allow uploads. Since this
-- app doesn't use Supabase Auth (custom login system, always talking to
-- Supabase as the anon key), uploads need an explicit policy granting
-- the anon role write access to storage.objects, same as every other
-- table in this app (the "anon_all" pattern).
-- Safe to run multiple times.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'anon_all_project_photos'
  ) THEN
    CREATE POLICY anon_all_project_photos ON storage.objects FOR ALL TO anon
      USING (bucket_id = 'project-photos') WITH CHECK (bucket_id = 'project-photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'anon_all_task_photos'
  ) THEN
    CREATE POLICY anon_all_task_photos ON storage.objects FOR ALL TO anon
      USING (bucket_id = 'task-photos') WITH CHECK (bucket_id = 'task-photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'anon_all_plans'
  ) THEN
    CREATE POLICY anon_all_plans ON storage.objects FOR ALL TO anon
      USING (bucket_id = 'plans') WITH CHECK (bucket_id = 'plans');
  END IF;
END $$;
