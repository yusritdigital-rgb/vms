-- =====================================================
-- VMS — 007_workshops_and_vehicle_extensions.sql
-- Adds the Workshop Management module.
-- Additive & idempotent: safe to re-run.
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1) workshops
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workshops (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  workshop_name_ar  TEXT NOT NULL,
  workshop_name_en  TEXT,
  slug              TEXT,                      -- reserved for future short-code use (e.g. URLs / labels)

  -- Location
  city_ar           TEXT,                      -- NULL when coverage is nationwide
  city_en           TEXT,
  coverage_type     TEXT NOT NULL DEFAULT 'city'
                      CHECK (coverage_type IN ('city', 'nationwide', 'nationwide_non_agency')),
  is_agency         BOOLEAN NOT NULL DEFAULT false,
  latitude          NUMERIC(9, 6),             -- city centroid, NULL when nationwide
  longitude         NUMERIC(9, 6),

  -- State
  active_status     BOOLEAN NOT NULL DEFAULT true,
  notes             TEXT,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup indexes for the eventual map dashboard
CREATE INDEX IF NOT EXISTS idx_workshops_coverage ON workshops(coverage_type);
CREATE INDEX IF NOT EXISTS idx_workshops_city     ON workshops(city_ar);
CREATE INDEX IF NOT EXISTS idx_workshops_active   ON workshops(active_status);

-- Uniqueness by (name + city). Nationwide entries share a virtual "__national__"
-- key so the same name can exist once per "nationwide" / "nationwide_non_agency".
CREATE UNIQUE INDEX IF NOT EXISTS uq_workshops_name_city
  ON workshops(workshop_name_ar, COALESCE(city_ar, '__national__'));

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.fn_stamp_workshop_updated()
RETURNS TRIGGER AS $f$
BEGIN
  NEW.last_updated_at := NOW();
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workshops_stamp_updated ON workshops;
CREATE TRIGGER trg_workshops_stamp_updated
  BEFORE UPDATE ON workshops
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_workshop_updated();

-- RLS: authenticated-all (same pattern as invoices / appointments)
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workshops_authenticated_all" ON workshops;
CREATE POLICY "workshops_authenticated_all" ON workshops
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────
-- 2) vehicles — additive columns for the new CSV import
--    Conditional: only runs if the vehicles table exists.
--    If the table does not exist yet, it will be created on
--    first CSV import with these columns already in place
--    (the app is schema-tolerant), OR you can run your
--    original vehicles migration first and re-run this one.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles') THEN
    ALTER TABLE vehicles
      ADD COLUMN IF NOT EXISTS plate_number_ar TEXT,
      ADD COLUMN IF NOT EXISTS project_code    TEXT,
      ADD COLUMN IF NOT EXISTS manufacturer    TEXT;

    CREATE INDEX IF NOT EXISTS idx_vehicles_project_code ON vehicles(project_code);
    CREATE INDEX IF NOT EXISTS idx_vehicles_plate_ar     ON vehicles(plate_number_ar);
  ELSE
    -- Bootstrap a minimal vehicles table so the import flow works on a fresh DB.
    CREATE TABLE vehicles (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plate_number      TEXT,
      plate_number_ar   TEXT,
      chassis_number    TEXT,
      brand             TEXT,
      manufacturer      TEXT,
      model             TEXT,
      year              INT,
      color             TEXT,
      vehicle_type      TEXT,
      vehicle_classification TEXT,
      is_mobile_maintenance  BOOLEAN NOT NULL DEFAULT false,
      current_odometer  INT NOT NULL DEFAULT 0,
      project_code      TEXT,
      company_id        UUID,
      driver_id         UUID,
      group_assignment  TEXT,
      registration_expiry_hijri TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_vehicles_plate_number  ON vehicles(plate_number);
    CREATE INDEX idx_vehicles_chassis       ON vehicles(chassis_number);
    CREATE INDEX idx_vehicles_project_code  ON vehicles(project_code);
    CREATE INDEX idx_vehicles_plate_ar      ON vehicles(plate_number_ar);

    -- RLS (authenticated-all, matching other tables)
    ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "vehicles_authenticated_all" ON vehicles
      FOR ALL USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');

    RAISE NOTICE 'vehicles table did not exist — created minimal bootstrap schema.';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- 3) job_cards ↔ workshops link (for the map "cases per workshop")
--    Conditional: only runs if the job_cards table exists.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cards') THEN
    -- Add the FK column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'job_cards' AND column_name = 'workshop_id'
    ) THEN
      ALTER TABLE job_cards
        ADD COLUMN workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL;
    END IF;

    -- Helpful index for the aggregate query below
    CREATE INDEX IF NOT EXISTS idx_job_cards_workshop_id
      ON job_cards(workshop_id);
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- 4) v_workshop_case_counts — convenience view for the map
--    Returns one row per workshop with case counts by status.
--    Joinable directly in the dashboard; authenticated-readable.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cards') THEN
    EXECUTE $v$
      CREATE OR REPLACE VIEW v_workshop_case_counts AS
      SELECT
        w.id                                                   AS workshop_id,
        w.workshop_name_ar,
        w.workshop_name_en,
        w.city_ar,
        w.coverage_type,
        w.is_agency,
        w.latitude,
        w.longitude,
        w.active_status,
        COALESCE(c.total_cases,        0)::INT                 AS total_cases,
        COALESCE(c.open_cases,         0)::INT                 AS open_cases,
        COALESCE(c.closed_cases,       0)::INT                 AS closed_cases
      FROM workshops w
      LEFT JOIN (
        SELECT
          workshop_id,
          COUNT(*) FILTER (WHERE workshop_id IS NOT NULL)                             AS total_cases,
          COUNT(*) FILTER (WHERE status IN ('received', 'under_repair', 'repaired'))  AS open_cases,
          COUNT(*) FILTER (WHERE status = 'delivered')                                AS closed_cases
        FROM job_cards
        WHERE workshop_id IS NOT NULL
        GROUP BY workshop_id
      ) c ON c.workshop_id = w.id;
    $v$;

    -- The view inherits RLS from job_cards / workshops, but we make the
    -- grant explicit so PostgREST exposes it.
    GRANT SELECT ON v_workshop_case_counts TO authenticated;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- 5) Seed master workshop list (idempotent)
--    Coordinates are city centroids; refine later with
--    the visual map editor.
-- ─────────────────────────────────────────────────────
INSERT INTO workshops
  (workshop_name_ar, city_ar, coverage_type, is_agency, latitude, longitude)
VALUES
  -- Jeddah
  ('افاق الحديثة',       'جدة',           'city', false, 21.4858, 39.1925),
  ('الاوائل',            'جدة',           'city', false, 21.4858, 39.1925),
  ('الدوحة',             'جدة',           'city', false, 21.4858, 39.1925),
  ('ساك',                'جدة',           'city', false, 21.4858, 39.1925),
  ('نجم المركبة',        'جدة',           'city', false, 21.4858, 39.1925),

  -- Riyadh
  ('الاوائل',            'الرياض',        'city', false, 24.7136, 46.6753),
  ('السجو',              'الرياض',        'city', false, 24.7136, 46.6753),
  ('حريص',               'الرياض',        'city', false, 24.7136, 46.6753),

  -- Jubail
  ('الاوائل',            'الجبيل',        'city', false, 27.0174, 49.6251),

  -- Ahsa
  ('التقنية',            'الاحساء',       'city', false, 25.3647, 49.5878),

  -- Khamis Mushait
  ('الجياد الابيض',      'خميس مشيط',     'city', false, 18.3000, 42.7333),
  ('الذهبية',            'خميس مشيط',     'city', false, 18.3000, 42.7333),

  -- Najran
  ('الجياد الابيض',      'نجران',         'city', false, 17.4917, 44.1322),

  -- Jizan
  ('الجياد الابيض',      'جيزان',         'city', false, 16.8892, 42.5511),
  ('الذهبية',            'جيزان',         'city', false, 16.8892, 42.5511),

  -- Tabuk
  ('الجياد الابيض',      'تبوك',          'city', false, 28.3998, 36.5700),
  ('ركن الربيع',         'تبوك',          'city', false, 28.3998, 36.5700),

  -- Dammam
  ('ساك',                'الدمام',        'city', false, 26.4207, 50.0888),
  ('رؤية',               'الدمام',        'city', false, 26.4207, 50.0888),
  ('ماهر الابراهيم',     'الدمام',        'city', false, 26.4207, 50.0888),
  ('المستقبل',           'الدمام',        'city', false, 26.4207, 50.0888),
  ('اليمنى',             'الدمام',        'city', false, 26.4207, 50.0888),
  ('حلا الغد',           'الدمام',        'city', false, 26.4207, 50.0888),

  -- Hail
  ('الكثيري',            'حائل',          'city', false, 27.5219, 41.7057),

  -- Madinah
  ('نجم المركبة',        'المدينة المنورة','city', false, 24.5247, 39.5692),
  ('برو كار',            'المدينة المنورة','city', false, 24.5247, 39.5692),

  -- Taif
  ('لمسات فنان',         'الطائف',        'city', false, 21.2703, 40.4158),

  -- Nationwide agencies (وكالة حول المملكة)
  ('توكيلات العالمية',   NULL, 'nationwide', true,  NULL, NULL),
  ('الجبر',              NULL, 'nationwide', true,  NULL, NULL),
  ('الجميح',             NULL, 'nationwide', true,  NULL, NULL),
  ('كيا الاهلية',        NULL, 'nationwide', true,  NULL, NULL),
  ('التوكيلات العالمية', NULL, 'nationwide', true,  NULL, NULL),
  ('نيسان',              NULL, 'nationwide', true,  NULL, NULL),
  ('الوعلان',            NULL, 'nationwide', true,  NULL, NULL),
  ('هلا السعودية',       NULL, 'nationwide', true,  NULL, NULL),

  -- Nationwide non-agency (حول المملكة)
  ('بترومين',            NULL, 'nationwide_non_agency', false, NULL, NULL)

ON CONFLICT DO NOTHING;
