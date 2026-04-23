-- =====================================================
-- VMS - Switch from company-based to track-based permissions
-- Run AFTER 001_users_and_auth.sql (and 003 hotfix if already applied).
-- Safe to run multiple times.
-- =====================================================

-- 1) Add `track` column to user_preferences
--    NULL   => user sees everything (both maintenance AND operations)
--    'maintenance' => maintenance-only scope
--    'operations'  => operations-only scope
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS track TEXT
  CHECK (track IS NULL OR track IN ('maintenance', 'operations'));

CREATE INDEX IF NOT EXISTS idx_user_preferences_track ON user_preferences(track);

-- 2) Case (formerly job_card) tracking fields — create only if job_cards table
--    exists. These are optional and only used once business tables exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cards') THEN
    ALTER TABLE job_cards
      -- Audit trail (stamped automatically by the trigger below)
      ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES auth.users(id),
      ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT NOW(),

      -- Fields used by the new "Create Case" page. All optional so any
      -- existing rows continue to work unchanged.
      ADD COLUMN IF NOT EXISTS entry_type              TEXT,
      ADD COLUMN IF NOT EXISTS closure_type            TEXT DEFAULT 'مفتوحة',
      ADD COLUMN IF NOT EXISTS workshop_entry_date     DATE,
      ADD COLUMN IF NOT EXISTS internal_notes          TEXT,
      ADD COLUMN IF NOT EXISTS has_replacement_vehicle BOOLEAN DEFAULT FALSE,

      -- Denormalised workshop snapshot (so a future interactive map can
      -- render case dots without joining a workshops table).
      ADD COLUMN IF NOT EXISTS workshop_id        TEXT,
      ADD COLUMN IF NOT EXISTS workshop_name      TEXT,
      ADD COLUMN IF NOT EXISTS workshop_city      TEXT,
      ADD COLUMN IF NOT EXISTS workshop_coverage  TEXT
        CHECK (workshop_coverage IS NULL OR workshop_coverage IN ('city', 'nationwide', 'nationwide_non_agency')),
      ADD COLUMN IF NOT EXISTS workshop_is_agency BOOLEAN DEFAULT FALSE;

    CREATE INDEX IF NOT EXISTS idx_job_cards_workshop_id ON job_cards(workshop_id);
    CREATE INDEX IF NOT EXISTS idx_job_cards_status      ON job_cards(status);
  END IF;
END $$;

-- 2b) Auto-stamp `last_updated_by` / `last_updated_at` on EVERY update to
--     job_cards, regardless of which columns change (business rule: any
--     modification must be attributable and timestamped).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_cards') THEN
    -- (Re)create the trigger function in a way that is idempotent.
    CREATE OR REPLACE FUNCTION public.fn_stamp_job_card_update()
    RETURNS TRIGGER AS $f$
    BEGIN
      NEW.last_updated_at := NOW();
      -- auth.uid() returns the Supabase-authenticated user's id (or NULL
      -- for service-role / server-side operations). Fall back to the
      -- previous value so server jobs don't wipe the attribution.
      NEW.last_updated_by := COALESCE(auth.uid(), NEW.last_updated_by, OLD.last_updated_by);
      RETURN NEW;
    END;
    $f$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS trg_job_cards_stamp_update ON job_cards;
    CREATE TRIGGER trg_job_cards_stamp_update
      BEFORE UPDATE ON job_cards
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_stamp_job_card_update();
  END IF;
END $$;

-- 2c) Also bump the parent case when child rows change (works / spare parts /
--     damages). Doing a no-op UPDATE on the parent re-fires the BEFORE UPDATE
--     trigger above, which handles the stamping.
CREATE OR REPLACE FUNCTION public.fn_touch_parent_job_card()
RETURNS TRIGGER AS $f$
DECLARE
  parent_id UUID;
BEGIN
  parent_id := COALESCE(NEW.job_card_id, OLD.job_card_id);
  IF parent_id IS NOT NULL THEN
    UPDATE job_cards SET id = id WHERE id = parent_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$f$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
  child TEXT;
BEGIN
  FOREACH child IN ARRAY ARRAY['job_card_works', 'job_card_spare_parts', 'job_card_damages']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = child) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_parent ON %I', child, child);
      EXECUTE format(
        'CREATE TRIGGER trg_%I_touch_parent
           AFTER INSERT OR UPDATE OR DELETE ON %I
           FOR EACH ROW EXECUTE FUNCTION public.fn_touch_parent_job_card()',
        child, child
      );
    END IF;
  END LOOP;
END $$;

-- 3) Company-based logic is now deprecated.
--    The column `user_preferences.company_id` and the `user_companies`
--    table are kept for backward compatibility but are NOT used by the
--    new track-based access logic. They can be dropped later.
COMMENT ON COLUMN user_preferences.company_id IS 'DEPRECATED: replaced by `track`. Kept for backward compat.';
COMMENT ON TABLE  user_companies IS 'DEPRECATED: replaced by user_preferences.track. Kept for backward compat.';
