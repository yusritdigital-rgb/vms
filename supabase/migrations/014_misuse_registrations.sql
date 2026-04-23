-- =====================================================
-- VMS — 014_misuse_registrations.sql
-- -----------------------------------------------------
-- Misuse / repair-cost charge registration system
-- (نظام تسجيل حالات سوء الاستخدام).
--
-- Parallel to the Invoices module (see migration 005_invoices.sql)
-- and sharing the same conventions:
--   - human-readable registration number MU-YYYY-NNNN
--   - totals stored on the parent (subtotal / discount / VAT / total)
--   - labor items and spare-part items in dedicated child tables
-- Visibility/permissions are enforced at the app layer (supervisor-only).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.misuse_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT UNIQUE NOT NULL,
  registration_date   DATE NOT NULL DEFAULT CURRENT_DATE,

  project_name        TEXT,
  vehicle_id          UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_type        TEXT,
  plate_number        TEXT,

  notes               TEXT,

  subtotal            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_percentage NUMERIC(5, 2)  NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vat_percentage      NUMERIC(5, 2)  NOT NULL DEFAULT 15,
  vat_amount          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total               NUMERIC(12, 2) NOT NULL DEFAULT 0,

  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_misuse_registrations_date
  ON public.misuse_registrations (registration_date DESC);
CREATE INDEX IF NOT EXISTS idx_misuse_registrations_plate
  ON public.misuse_registrations (plate_number);

-- ─── Labor items (dynamic rows) ───────────────────────
CREATE TABLE IF NOT EXISTS public.misuse_labor_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  misuse_id    UUID NOT NULL REFERENCES public.misuse_registrations(id) ON DELETE CASCADE,
  row_number   INT  NOT NULL DEFAULT 1,
  description  TEXT NOT NULL,
  cost         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_misuse_labor_items_parent
  ON public.misuse_labor_items (misuse_id, row_number);

-- ─── Spare-part items (dynamic rows) ──────────────────
CREATE TABLE IF NOT EXISTS public.misuse_spare_part_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  misuse_id    UUID NOT NULL REFERENCES public.misuse_registrations(id) ON DELETE CASCADE,
  row_number   INT  NOT NULL DEFAULT 1,
  part_name    TEXT NOT NULL,
  quantity     NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  line_total   NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_misuse_parts_items_parent
  ON public.misuse_spare_part_items (misuse_id, row_number);

-- ─── Updated-at trigger (parent only) ─────────────────
CREATE OR REPLACE FUNCTION public.fn_misuse_stamp_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_misuse_stamp_update ON public.misuse_registrations;
CREATE TRIGGER trg_misuse_stamp_update
  BEFORE UPDATE ON public.misuse_registrations
  FOR EACH ROW EXECUTE FUNCTION public.fn_misuse_stamp_update();

-- ─── RLS: authenticated users can read/write; app enforces supervisor ─
ALTER TABLE public.misuse_registrations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misuse_labor_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misuse_spare_part_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['misuse_registrations',
                           'misuse_labor_items',
                           'misuse_spare_part_items']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      t || '_authenticated_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
      t || '_service_role_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_authenticated_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role_all', t);
  END LOOP;
END $$;

-- Force PostgREST to re-read the schema.
NOTIFY pgrst, 'reload schema';
