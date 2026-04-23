-- =====================================================
-- VMS — 015_enable_realtime_cases.sql
-- -----------------------------------------------------
-- ROOT-CAUSE FIX (part 1) for "created cases don't appear in the
-- Cases module": the Supabase Realtime engine only replays events
-- for tables that are explicitly added to the
-- `supabase_realtime` publication. None of the previous migrations
-- added `job_cards` / `case_updates` / `misuse_registrations`, so
-- the client's `postgres_changes` subscription silently received
-- nothing and the list never refreshed after an INSERT.
--
-- This migration:
--   1) Creates the `supabase_realtime` publication if it is missing
--      (on self-hosted installs it is not always pre-created).
--   2) Adds our case-facing tables to it, idempotently.
--   3) Reloads the PostgREST schema cache so the client sees the
--      change without a container restart.
--
-- Safe to re-run.
-- =====================================================

-- 1) Make sure the publication exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- 2) Add every case-facing table, only if not already in the publication.
DO $$
DECLARE
  tbl TEXT;
  candidates TEXT[] := ARRAY[
    'job_cards',
    'case_updates',
    'misuse_registrations',
    'misuse_labor_items',
    'misuse_spare_part_items'
  ];
BEGIN
  FOREACH tbl IN ARRAY candidates LOOP
    -- Skip if the table itself does not exist yet on this deployment.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      CONTINUE;
    END IF;

    -- Skip if already in the publication.
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
  END LOOP;
END $$;

-- 3) Make sure PostgREST re-reads the schema.
NOTIFY pgrst, 'reload schema';
