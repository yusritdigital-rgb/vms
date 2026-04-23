-- =====================================================
-- VMS — 006_appointments.sql
-- Adds the Maintenance Appointments module.
-- Fully additive and idempotent.
-- =====================================================

CREATE TABLE IF NOT EXISTS appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_number  TEXT NOT NULL UNIQUE,

  -- Customer
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT,

  -- Vehicle link + denormalised snapshot
  vehicle_id          UUID,
  vehicle_plate       TEXT,
  vehicle_label       TEXT,
  mileage             INT,

  -- Service context
  complaint           TEXT,
  notes               TEXT,

  -- Scheduling
  scheduled_date      DATE NOT NULL,
  scheduled_time      TIME NOT NULL,

  status              TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'done', 'cancelled')),

  -- Audit
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_by     UUID REFERENCES auth.users(id),
  last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date
  ON appointments(scheduled_date DESC, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_vehicle
  ON appointments(vehicle_id);

-- Conditional FK to vehicles (only if that table exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'appointments_vehicle_id_fkey'
     ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Audit trigger (mirrors invoices / job_cards).
CREATE OR REPLACE FUNCTION public.fn_stamp_appointment_updated()
RETURNS TRIGGER AS $f$
BEGIN
  NEW.last_updated_at := NOW();
  IF NEW.last_updated_by IS NULL THEN
    NEW.last_updated_by := OLD.last_updated_by;
  END IF;
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_stamp_updated ON appointments;
CREATE TRIGGER trg_appointments_stamp_updated
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_appointment_updated();

-- RLS: authenticated users only. Track-level gating stays in the app layer.
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appointments_authenticated_all" ON appointments;
CREATE POLICY "appointments_authenticated_all" ON appointments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
