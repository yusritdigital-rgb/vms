-- =====================================================
-- VMS — 021_vehicle_odometer_readings.sql
-- ----------------------------------------------------------
-- Historical odometer readings per vehicle. Each row is an immutable
-- record of an observed reading captured at a known business event
-- (currently: case-entry for the main vehicle, and case-entry for the
-- replacement vehicle handed out during a case).
--
-- Invariants enforced at the DB layer:
--   1. A new reading must be >= the most-recently recorded reading for
--      the same vehicle (monotonic). If the vehicle has no prior
--      readings, any non-negative value is accepted.
--   2. After a successful insert, vehicles.current_odometer is bumped
--      to MAX(current, new) so the cached last-known value stays
--      truthful without requiring the app to know about the trigger.
--
-- This file is idempotent — safe to re-run.
-- =====================================================

-- 1. Table -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_odometer_readings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    UUID        NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  reading       INTEGER     NOT NULL CHECK (reading >= 0),
  source        TEXT        NOT NULL CHECK (source IN (
                                'case_entry',
                                'case_replacement_entry',
                                'case_exit',
                                'manual'
                              )),
  case_id       UUID        NULL REFERENCES public.job_cards(id) ON DELETE SET NULL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by   UUID        NULL,    -- auth.users(id) — kept loose to avoid auth-schema FK headaches
  notes         TEXT        NULL
);

CREATE INDEX IF NOT EXISTS idx_voreadings_vehicle_recorded_at
  ON public.vehicle_odometer_readings (vehicle_id, recorded_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_voreadings_case_id
  ON public.vehicle_odometer_readings (case_id);

-- 2. Monotonic-reading guard (BEFORE INSERT) --------------------------
-- A new reading is allowed iff:
--   • the vehicle has no prior reading, OR
--   • the new reading is >= the latest prior reading.
-- We compare against MAX(reading) rather than "latest by recorded_at"
-- so an out-of-order back-fill can never lower the floor.
CREATE OR REPLACE FUNCTION public.enforce_odometer_monotonic()
RETURNS TRIGGER AS $$
DECLARE
  prior_max INTEGER;
  vehicle_baseline INTEGER;
BEGIN
  SELECT MAX(reading) INTO prior_max
    FROM public.vehicle_odometer_readings
   WHERE vehicle_id = NEW.vehicle_id;

  -- Treat the cached vehicles.current_odometer as a baseline as well, so
  -- migrations on existing fleets (where readings table is initially
  -- empty) can't accept a reading that is lower than the value already
  -- recorded on the vehicle itself.
  SELECT current_odometer INTO vehicle_baseline
    FROM public.vehicles
   WHERE id = NEW.vehicle_id;

  IF prior_max IS NOT NULL AND NEW.reading < prior_max THEN
    RAISE EXCEPTION 'odometer_decreased: new reading % is less than last recorded reading %',
      NEW.reading, prior_max
      USING ERRCODE = '23514',
            HINT = 'Odometer can only stay the same or increase.';
  END IF;

  IF prior_max IS NULL
     AND vehicle_baseline IS NOT NULL
     AND NEW.reading < vehicle_baseline THEN
    RAISE EXCEPTION 'odometer_decreased: new reading % is less than vehicle baseline %',
      NEW.reading, vehicle_baseline
      USING ERRCODE = '23514',
            HINT = 'Odometer can only stay the same or increase.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_voreadings_monotonic ON public.vehicle_odometer_readings;
CREATE TRIGGER trg_voreadings_monotonic
  BEFORE INSERT ON public.vehicle_odometer_readings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_odometer_monotonic();

-- 3. Keep vehicles.current_odometer in sync (AFTER INSERT) ------------
-- Only ratchets upwards — same monotonic spirit as the BEFORE-INSERT
-- guard. NULL current_odometer is replaced unconditionally by the new
-- reading.
CREATE OR REPLACE FUNCTION public.sync_vehicle_current_odometer()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.vehicles
     SET current_odometer = NEW.reading
   WHERE id = NEW.vehicle_id
     AND (current_odometer IS NULL OR NEW.reading > current_odometer);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_voreadings_sync_vehicle ON public.vehicle_odometer_readings;
CREATE TRIGGER trg_voreadings_sync_vehicle
  AFTER INSERT ON public.vehicle_odometer_readings
  FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_current_odometer();

-- 4. RLS — same permissive policy used by the rest of the schema -----
-- (the app authenticates with supabase-js and relies on row-level
-- security being open within the authenticated role). Tighten later if
-- multi-tenant separation is needed.
ALTER TABLE public.vehicle_odometer_readings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'vehicle_odometer_readings'
       AND policyname = 'voreadings_all'
  ) THEN
    CREATE POLICY voreadings_all ON public.vehicle_odometer_readings
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
