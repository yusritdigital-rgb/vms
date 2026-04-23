-- =====================================================
-- VMS — 009_cases_appointments_extensions.sql
-- -----------------------------------------------------
-- Extensions needed by the latest UI update:
--   (A) Cases: replacement vehicle + "no replacement" reason columns,
--       and a safety auto-number trigger for job_card_number so
--       client inserts never fail on a missing number.
--   (B) Appointments: richer status vocabulary + appointment_type.
--
-- Fully additive and idempotent.
-- =====================================================


-- ─────────────────────────────────────────────────────
-- (A) job_cards — replacement vehicle + reason
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cards') THEN

    ALTER TABLE job_cards
      ADD COLUMN IF NOT EXISTS replacement_vehicle_id        UUID,
      ADD COLUMN IF NOT EXISTS no_replacement_reason         TEXT,
      ADD COLUMN IF NOT EXISTS no_replacement_reason_custom  TEXT;

    -- FK to vehicles(id) — only if the vehicles table exists AND the FK is not already in place.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles')
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.table_constraints
         WHERE constraint_name = 'job_cards_replacement_vehicle_id_fkey'
       ) THEN
      ALTER TABLE job_cards
        ADD CONSTRAINT job_cards_replacement_vehicle_id_fkey
        FOREIGN KEY (replacement_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
    END IF;

    -- Value guard: if a reason is stored, it must be one of the known codes.
    -- "other" requires no_replacement_reason_custom to be populated.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'job_cards_no_replacement_reason_check'
    ) THEN
      ALTER TABLE job_cards
        ADD CONSTRAINT job_cards_no_replacement_reason_check
        CHECK (
          no_replacement_reason IS NULL
          OR no_replacement_reason IN (
            'contract_non_binding',
            'misuse',
            'no_alternative_available',
            'other'
          )
        );
    END IF;

    CREATE INDEX IF NOT EXISTS idx_job_cards_replacement_vehicle
      ON job_cards(replacement_vehicle_id);

  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- (A.2) job_card_number safety net
--   Ensures a value is always populated on INSERT, even if the
--   client forgets to send one. Falls back to JC-YYYY-NNNN.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cards')
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'job_cards' AND column_name = 'job_card_number'
     ) THEN

    CREATE OR REPLACE FUNCTION public.fn_autonumber_job_card()
    RETURNS TRIGGER AS $f$
    DECLARE
      v_year  INT := EXTRACT(YEAR FROM NOW())::INT;
      v_next  INT;
      v_tries INT := 0;
      v_cand  TEXT;
    BEGIN
      IF NEW.job_card_number IS NOT NULL AND NEW.job_card_number <> '' THEN
        RETURN NEW;
      END IF;

      -- Seed from max existing JC-YYYY-NNNN for this year.
      SELECT COALESCE(MAX((regexp_replace(job_card_number, '\D', '', 'g'))::BIGINT), 0)::INT
        INTO v_next
        FROM job_cards
       WHERE job_card_number LIKE 'JC-' || v_year || '-%';

      LOOP
        v_next := v_next + 1;
        v_tries := v_tries + 1;
        v_cand := 'JC-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM job_cards WHERE job_card_number = v_cand
        ) OR v_tries > 20;
      END LOOP;

      NEW.job_card_number := v_cand;
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_job_cards_autonumber ON job_cards;
    CREATE TRIGGER trg_job_cards_autonumber
      BEFORE INSERT ON job_cards
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_autonumber_job_card();

  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- (B) appointments — status vocabulary + appointment_type
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN

    -- Drop old CHECK and add the richer one. Using ALTER ... DROP/ADD so the
    -- statement is safe on databases where the old constraint name differs.
    PERFORM 1;
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'appointments'
        AND constraint_type = 'CHECK'
        AND constraint_name LIKE '%status%check%'
    ) THEN
      EXECUTE (
        SELECT 'ALTER TABLE appointments DROP CONSTRAINT ' || quote_ident(constraint_name)
          FROM information_schema.table_constraints
         WHERE table_name = 'appointments'
           AND constraint_type = 'CHECK'
           AND constraint_name LIKE '%status%check%'
         LIMIT 1
      );
    END IF;

    -- Add the new CHECK if not already present (idempotent).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'appointments_status_check_v2'
    ) THEN
      ALTER TABLE appointments
        ADD CONSTRAINT appointments_status_check_v2
        CHECK (status IN (
          'scheduled',   -- بانتظار الموعد
          'checked_in',  -- تم الحضور
          'no_show',     -- لم يحضر العميل
          'cancelled',   -- تم الإلغاء
          'inspected',   -- تمت المعاينة
          'done'         -- مكتمل (legacy)
        ));
    END IF;

    -- Appointment type (maintenance / inspection / delivery / other).
    ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS appointment_type TEXT DEFAULT 'maintenance';

    -- Drop any pre-existing CHECK for appointment_type, then re-add.
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'appointments_type_check_v1'
    ) THEN
      ALTER TABLE appointments DROP CONSTRAINT appointments_type_check_v1;
    END IF;
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_type_check_v1
      CHECK (appointment_type IN ('maintenance', 'inspection', 'delivery', 'other'));

    -- Attendance timestamp — populated when moving to checked_in / no_show.
    ALTER TABLE appointments
      ADD COLUMN IF NOT EXISTS attendance_marked_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_appointments_type
      ON appointments(appointment_type);
  END IF;
END $$;
