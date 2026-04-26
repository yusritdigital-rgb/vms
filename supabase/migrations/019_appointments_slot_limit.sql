-- =====================================================
-- VMS — 019_appointments_slot_limit.sql
-- Enforce max 2 active appointments per (scheduled_date, scheduled_time).
-- Cancelled appointments do NOT consume a slot.
-- Idempotent.
-- =====================================================

CREATE OR REPLACE FUNCTION public.fn_appointments_enforce_slot_limit()
RETURNS TRIGGER AS $f$
DECLARE
  v_count INT;
  v_max   CONSTANT INT := 2;
BEGIN
  -- Only enforce when the row would be ACTIVE (not cancelled) on the
  -- given (date, time). On UPDATE, exclude the row itself.
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM appointments a
  WHERE a.scheduled_date = NEW.scheduled_date
    AND a.scheduled_time = NEW.scheduled_time
    AND a.status <> 'cancelled'
    AND (TG_OP = 'INSERT' OR a.id <> NEW.id);

  IF v_count >= v_max THEN
    RAISE EXCEPTION
      'هذا الموعد ممتلئ (%/%). اختر وقتاً آخر.',
      v_max, v_max
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_slot_limit ON appointments;
CREATE TRIGGER trg_appointments_slot_limit
  BEFORE INSERT OR UPDATE OF scheduled_date, scheduled_time, status
  ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_appointments_enforce_slot_limit();
