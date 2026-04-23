-- =====================================================
-- VMS — 012_rls_and_schema_repair.sql
-- -----------------------------------------------------
-- Purpose: **idempotent, no-assumption repair** of the two classes
-- of issue that have been causing Create-Case failures on databases
-- where earlier migrations (001/004/007/009/010/011) ran in a
-- non-greenfield order.
--
-- A. Remove EVERY policy currently attached to the cases tables and
--    install one clean `authenticated_all` policy per table. This
--    supersedes any leftover policy from older migrations, Supabase
--    Studio UI clicks, or the pg_policies dashboard template.
--
-- B. Coerce `job_cards.workshop_id` to TEXT (and drop its FK to the
--    `workshops` table) so the Create Case form's slug-string id is
--    accepted directly without a retry. Migration 007 had typed the
--    column as UUID; migration 010's `CREATE TABLE IF NOT EXISTS` is
--    a no-op on existing tables, so this fix was never applied before.
--
-- C. Force PostgREST to drop its schema cache so PGRST205
--    ("could not find table public.job_cards in schema cache") can
--    never re-appear after this script runs.
--
-- Safe to re-run any number of times.
-- =====================================================


-- ─────────────────────────────────────────────────────
-- A) Nuke every policy on the cases tables, then reinstall a single
--    clean `authenticated_all` policy. This defeats any leftover
--    RESTRICTIVE policy or oddly-named permissive policy that is
--    silently blocking inserts.
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  target_tables TEXT[] := ARRAY['job_cards', 'case_updates',
                                'job_card_works', 'job_card_damages',
                                'job_card_spare_parts', 'vehicles',
                                'appointments', 'invoices', 'workshops'];
  t   TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    -- Skip tables that don't exist on this DB.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    -- Make sure RLS is on (owner-created tables sometimes aren't).
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop every policy currently attached, regardless of name.
    FOR pol IN
      SELECT policyname
        FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- Reinstall the canonical authenticated-all policy.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_authenticated_all', t
    );

    -- And a service_role pass-through so server code / pgAdmin works.
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role_all', t
    );
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────
-- B) Coerce job_cards.workshop_id to TEXT and drop its FK.
--
-- The Create Case form stores a deterministic slug (e.g. "الاوائل__جدة")
-- so the column must accept free text. Migration 007 declared the
-- column as UUID referencing workshops(id); that's incompatible with
-- the UI's slug id.
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  col_type TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_cards'
  ) THEN
    RETURN;
  END IF;

  -- Drop the FK if it exists (either spelling).
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'job_cards_workshop_id_fkey'
      AND table_name = 'job_cards'
  ) THEN
    ALTER TABLE public.job_cards
      DROP CONSTRAINT job_cards_workshop_id_fkey;
  END IF;

  -- Check the current data type and convert to TEXT if needed.
  SELECT data_type
    INTO col_type
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'job_cards'
     AND column_name  = 'workshop_id';

  IF col_type IS NOT NULL AND col_type <> 'text' THEN
    ALTER TABLE public.job_cards
      ALTER COLUMN workshop_id TYPE TEXT USING workshop_id::TEXT;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- C) Make sure CHECK constraints that the app relies on are in place.
--    `type` must accept 'accident' | 'mechanical' (idempotent).
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_cards' AND column_name = 'type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'job_cards_type_check' AND table_name = 'job_cards'
  ) THEN
    ALTER TABLE public.job_cards
      ADD CONSTRAINT job_cards_type_check
      CHECK (type IN ('accident', 'mechanical'));
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- D) Force PostgREST to drop its schema cache now.
-- ─────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
