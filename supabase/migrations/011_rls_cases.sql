-- =====================================================
-- VMS — 011_rls_cases.sql
-- -----------------------------------------------------
-- Purpose: add the missing Row Level Security policies for
--   • job_cards
--   • case_updates
--   • job_card_works        (used by CommonFaultsChart)
--   • job_card_damages      (used by the case-detail page)
--
-- Observed error before this migration:
--   "new row violates row-level security policy for table \"job_cards\""
--
-- Root cause: these tables had RLS ENABLED (by older setup / by the
-- owner) but no policy was ever defined for `authenticated` — so
-- every INSERT / SELECT was silently denied for normal users.
--
-- Pattern used below matches every other table in the system
-- (vehicles, invoices, appointments, workshops): a single
-- "authenticated can do anything; anon and service_role also OK"
-- policy. Track/company-level gating is enforced at the app layer.
--
-- Idempotent: drops each policy before recreating.
-- =====================================================

-- ─────────────────────────────────────────────────────
-- job_cards
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'job_cards') THEN
    EXECUTE 'ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DROP POLICY IF EXISTS "job_cards_authenticated_all" ON public.job_cards;
CREATE POLICY "job_cards_authenticated_all"
  ON public.job_cards
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role bypasses RLS automatically but we add an explicit
-- policy so schema tooling (postgrest reload, pgAdmin) can still
-- see the table has coverage.
DROP POLICY IF EXISTS "job_cards_service_role_all" ON public.job_cards;
CREATE POLICY "job_cards_service_role_all"
  ON public.job_cards
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────
-- case_updates — already enabled in migration 010, refine policy
-- so the same pattern applies and old combined policy is cleaned up.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'case_updates') THEN
    EXECUTE 'ALTER TABLE public.case_updates ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DROP POLICY IF EXISTS "case_updates_rw_authenticated" ON public.case_updates;
DROP POLICY IF EXISTS "case_updates_authenticated_all" ON public.case_updates;
CREATE POLICY "case_updates_authenticated_all"
  ON public.case_updates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────
-- job_card_works + job_card_damages — same treatment. Some deployments
-- had these with RLS on but no policy, breaking the detail page.
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_card_works', 'job_card_damages'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated_all', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
        t || '_authenticated_all', t
      );
    END IF;
  END LOOP;
END $$;


-- ─────────────────────────────────────────────────────
-- Safety net: make sure `vehicles` also has a policy. The user
-- reported the dashboard shows 0 vehicles; if the earlier migration
-- created the table without a policy (possible on old deployments),
-- every `SELECT id FROM vehicles` returns an empty set even with
-- head:true + count:exact.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'vehicles') THEN
    EXECUTE 'ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DROP POLICY IF EXISTS "vehicles_authenticated_all" ON public.vehicles;
CREATE POLICY "vehicles_authenticated_all"
  ON public.vehicles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);


-- ─────────────────────────────────────────────────────
-- Ask PostgREST to reload its schema cache so the new policies and
-- any freshly-created table from migration 010 become visible to
-- the REST layer without a manual reload.
-- ─────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
