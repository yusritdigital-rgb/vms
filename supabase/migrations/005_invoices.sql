-- =====================================================
-- VMS — 005_invoices.sql
-- Adds the Invoices module (header + line items) used by the
-- new `/forms/invoices` pages. Fully additive and idempotent:
-- safe to run on any environment, including ones where the
-- legacy business tables (`vehicles`, `job_cards`) do not
-- exist yet.
-- =====================================================

-- ────────────────────────────────────────
-- 1) Header table
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number        TEXT NOT NULL UNIQUE,
  invoice_date          DATE NOT NULL DEFAULT CURRENT_DATE,

  status                TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'cancelled')),

  -- Free-text because the "repair type" list is business-owned and
  -- may grow (حادث / ميكانيكا / هيكل / دهان / تشخيص / أخرى / ...).
  repair_type           TEXT,

  -- Workshop identity (defaults to the internal shop).
  workshop_name         TEXT NOT NULL DEFAULT 'ورشة الأوائل',

  maintenance_manager   TEXT,
  technician            TEXT,
  work_hours            NUMERIC(10, 2) DEFAULT 0,
  beneficiary_company   TEXT,
  notes                 TEXT,

  -- Vehicle link + denormalised snapshot (so later vehicle edits
  -- never mutate a historical invoice).
  vehicle_id            UUID,
  vehicle_plate         TEXT,
  vehicle_label         TEXT,
  project               TEXT,

  -- Totals (stored — do NOT recompute from items at read-time).
  subtotal              NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vat_percentage        NUMERIC(5, 2)  NOT NULL DEFAULT 15,
  vat_amount            NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total                 NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Back-compat shim for the legacy multi-tenant model (nullable).
  company_id            UUID,

  -- Audit
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_by       UUID REFERENCES auth.users(id),
  last_updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_vehicle_id   ON invoices(vehicle_id);

-- Add FK to vehicles only if that table exists (dev may not have it yet).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'invoices_vehicle_id_fkey'
     ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_vehicle_id_fkey
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ────────────────────────────────────────
-- 2) Line items
-- ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  row_number   INT  NOT NULL DEFAULT 1,

  item_type    TEXT NOT NULL DEFAULT 'other'
    CHECK (item_type IN ('spare_part', 'labor', 'inspection', 'other')),

  description  TEXT NOT NULL DEFAULT '',
  quantity     NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Stored (GENERATED ALWAYS) so the DB is the source of truth for totals.
  line_total   NUMERIC(14, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON invoice_items(invoice_id, row_number);

-- ────────────────────────────────────────
-- 3) Auto-stamp last_updated_{by,at} on UPDATE
--    (mirrors the job_cards trigger added in 004_tracks.sql)
-- ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_stamp_invoice_updated()
RETURNS TRIGGER AS $f$
BEGIN
  NEW.last_updated_at := NOW();
  -- last_updated_by is set by the application layer (we have access to
  -- the user there). Preserve whatever the app supplied; only fall back
  -- to OLD if the app didn't set it.
  IF NEW.last_updated_by IS NULL THEN
    NEW.last_updated_by := OLD.last_updated_by;
  END IF;
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoices_stamp_updated ON invoices;
CREATE TRIGGER trg_invoices_stamp_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_invoice_updated();

-- When invoice_items change, bump the parent so last_updated_* stays fresh.
CREATE OR REPLACE FUNCTION public.fn_touch_parent_invoice()
RETURNS TRIGGER AS $f$
DECLARE
  parent_id UUID;
BEGIN
  parent_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF parent_id IS NOT NULL THEN
    UPDATE invoices SET last_updated_at = NOW() WHERE id = parent_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_items_touch_parent ON invoice_items;
CREATE TRIGGER trg_invoice_items_touch_parent
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_parent_invoice();

-- ────────────────────────────────────────
-- 4) RLS — authenticated users may read/write. (Matches the
--    permissive pattern used by the rest of the app; track-level
--    gating is enforced in the application layer / middleware.)
-- ────────────────────────────────────────
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_authenticated_all" ON invoices;
CREATE POLICY "invoices_authenticated_all" ON invoices
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "invoice_items_authenticated_all" ON invoice_items;
CREATE POLICY "invoice_items_authenticated_all" ON invoice_items
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
