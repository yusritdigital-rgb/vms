-- =====================================================
-- VMS — 013_auto_return_alternatives.sql
-- -----------------------------------------------------
-- Business rule: once a case is closed (تم التسليم للعميل /
-- تم البيع / خسارة كلية), any replacement (alternative)
-- vehicle that was linked to that case must automatically
-- return to the available pool.
--
-- How it's modeled in this schema:
--   - `vehicles.project_code` starting with "RV" = alternative.
--   - `job_cards.replacement_vehicle_id` points to the linked RV
--     vehicle while the case is open.
--   - A vehicle is considered "issued" when any NON-closed case
--     references it via replacement_vehicle_id.
--
-- Therefore, to return the RV vehicle to the pool on closure, it
-- is sufficient to NULL `job_cards.replacement_vehicle_id` at the
-- moment the status transitions into any of the closed statuses.
--
-- This trigger is the server-side source of truth. The UI does
-- the same thing client-side for immediate feedback, but the DB
-- is what guarantees correctness even if a status change happens
-- via SQL, migration, or a different client.
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_return_alternative_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act when the status actually transitions into a closed value.
  IF TG_OP = 'UPDATE'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('تم التسليم للعميل', 'تم البيع', 'خسارة كلية')
     AND NEW.replacement_vehicle_id IS NOT NULL
  THEN
    -- NULL the link so the vehicle flips back to "available" on next read.
    NEW.replacement_vehicle_id := NULL;

    -- Also record a line in case_updates so the timeline explains WHY
    -- the alternative disappeared (idempotent: source='trigger').
    BEGIN
      INSERT INTO public.case_updates (case_id, status, note, source)
      VALUES (
        NEW.id,
        NEW.status,
        'تم تحرير المركبة البديلة تلقائياً عند إغلاق الحالة.',
        'trigger'
      );
    EXCEPTION WHEN OTHERS THEN
      -- case_updates may not exist on very old schemas; swallow.
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_return_alternative_on_close ON public.job_cards;

CREATE TRIGGER trg_return_alternative_on_close
  BEFORE UPDATE ON public.job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_return_alternative_on_close();

-- Force PostgREST to re-read the schema so the new trigger is
-- visible to the API layer immediately.
NOTIFY pgrst, 'reload schema';
