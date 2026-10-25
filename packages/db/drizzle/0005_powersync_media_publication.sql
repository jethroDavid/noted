-- PowerSync is optional for local/test databases. If its publication already
-- exists, extend it without replacing existing tables or publishing server-only
-- receipt and worker-intent tables. Initial setup is documented in
-- powersync/README.md for databases connected after migrations have run.
DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'powersync') THEN
    FOREACH table_name IN ARRAY ARRAY['reels', 'book_entries', 'media_assets', 'note_revisions']
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'powersync' AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION powersync ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END
$$;
