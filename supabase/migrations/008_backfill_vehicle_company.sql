-- =====================================================
-- 008_backfill_vehicle_company.sql
-- -----------------------------------------------------
-- The app has moved to a single-tenant workshop model. UI code no longer
-- filters vehicles by company_id, but some legacy reports/charts still do.
-- After the CSV import, vehicles may exist with company_id = NULL (when the
-- import ran before any company row existed, or when the first-active
-- company lookup failed). This migration backfills those NULLs with a
-- stable default so every legacy query keeps seeing them.
--
-- Safe to re-run: only updates rows where company_id IS NULL, and no-ops
-- if the vehicles or companies tables are missing.
-- =====================================================

DO $$
DECLARE
  v_default uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vehicles'
  ) THEN
    RAISE NOTICE 'vehicles table not found - skipping';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vehicles'
      AND column_name  = 'company_id'
  ) THEN
    RAISE NOTICE 'vehicles.company_id column not found - skipping';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    RAISE NOTICE 'companies table not found - skipping';
    RETURN;
  END IF;

  -- Pick a stable default: first active company, falling back to any company.
  SELECT id INTO v_default
  FROM public.companies
  WHERE COALESCE(is_active, true) = true
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF v_default IS NULL THEN
    SELECT id INTO v_default
    FROM public.companies
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_default IS NULL THEN
    RAISE NOTICE 'No companies exist - cannot backfill vehicles.company_id';
    RETURN;
  END IF;

  UPDATE public.vehicles
     SET company_id = v_default
   WHERE company_id IS NULL;

  RAISE NOTICE 'Backfilled vehicles.company_id with %', v_default;
END $$;
