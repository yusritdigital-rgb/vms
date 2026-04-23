-- =====================================================
-- VMS — 010_case_tracking.sql
-- -----------------------------------------------------
-- Purpose:
--   (A) Bootstrap `public.job_cards` if it's missing. The earlier
--       migrations (004 / 007 / 009) only ALTER this table inside
--       `IF EXISTS` guards, which silently no-op on fresh DBs and
--       cause the PostgREST error:
--           PGRST205: Could not find the table 'public.job_cards'
--           in the schema cache
--   (B) Create `case_updates` — the daily-update history table
--       required by the new Cases workflow.
--   (C) Install a trigger that automatically logs every status
--       change on `job_cards` into `case_updates` so the timeline
--       can never miss a transition.
--
-- Fully idempotent and additive: running against a DB that already
-- has these objects is a no-op.
-- =====================================================


-- ─────────────────────────────────────────────────────
-- (A) job_cards — create only if missing
--
-- The column list is the UNION of every field the app currently
-- reads or writes. Anything added later by migrations 004 / 007 /
-- 009 is included here too so a single run of 010 on a fresh DB
-- produces a table compatible with all code paths.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_cards (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  job_card_number           TEXT NOT NULL UNIQUE,

  -- Core links
  vehicle_id                UUID REFERENCES vehicles(id) ON DELETE RESTRICT,
  company_id                UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Classification
  type                      TEXT NOT NULL CHECK (type IN ('accident', 'mechanical')),
  entry_type                TEXT,

  -- Status — stored as free Arabic text (no DB-side CHECK because the
  -- 17 business statuses live in src/lib/cases/statuses.ts and can
  -- evolve independently of the DB).
  status                    TEXT NOT NULL DEFAULT 'بانتظار تقدير',
  closure_type              TEXT DEFAULT 'مفتوحة',
  completed_at              TIMESTAMPTZ,

  -- Timing
  received_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  under_repair_at           TIMESTAMPTZ,
  repaired_at               TIMESTAMPTZ,
  delivered_at              TIMESTAMPTZ,
  deadline_at               TIMESTAMPTZ,
  workshop_entry_date       DATE,

  -- Odometer
  entry_odometer            INTEGER NOT NULL DEFAULT 0,
  exit_odometer             INTEGER,

  -- Description
  complaint_description     TEXT,
  internal_notes            TEXT,

  -- Flags
  has_mechanical_works      BOOLEAN DEFAULT FALSE,
  has_replacement_vehicle   BOOLEAN DEFAULT FALSE,

  -- Replacement vehicle (see migration 009 for details; included here
  -- so a fresh-bootstrap DB has them from the start).
  replacement_vehicle_id    UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  no_replacement_reason     TEXT,
  no_replacement_reason_custom TEXT,

  -- Workshop snapshot (denormalised)
  workshop_id               TEXT,
  workshop_name             TEXT,
  workshop_city             TEXT,
  workshop_coverage         TEXT
    CHECK (workshop_coverage IS NULL OR workshop_coverage IN ('city', 'nationwide', 'nationwide_non_agency')),
  workshop_is_agency        BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_cards_vehicle_id      ON job_cards(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_status          ON job_cards(status);
CREATE INDEX IF NOT EXISTS idx_job_cards_company_id      ON job_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_received_at     ON job_cards(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_cards_replacement_veh ON job_cards(replacement_vehicle_id);


-- ─────────────────────────────────────────────────────
-- (A.1) no_replacement_reason CHECK — only add if not already present.
-- (migration 009 also tries to add this; safe to duplicate the guard here
-- because the constraint name is shared.)
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
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
END $$;


-- ─────────────────────────────────────────────────────
-- (A.2) job_card_number auto-number trigger — identical to the one in
-- migration 009, but re-installed here so a DB that runs 010 without 009
-- (e.g. fresh bootstrap) still gets the safety net.
-- ─────────────────────────────────────────────────────
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

  SELECT COALESCE(MAX((regexp_replace(job_card_number, '\D', '', 'g'))::BIGINT), 0)::INT
    INTO v_next
    FROM job_cards
   WHERE job_card_number LIKE 'JC-' || v_year || '-%';

  LOOP
    v_next := v_next + 1;
    v_tries := v_tries + 1;
    v_cand := 'JC-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM job_cards WHERE job_card_number = v_cand)
           OR v_tries > 20;
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


-- ─────────────────────────────────────────────────────
-- (A.3) last_updated stamping trigger (mirrors 004).
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_stamp_job_card_update()
RETURNS TRIGGER AS $f$
BEGIN
  NEW.last_updated_at := NOW();
  NEW.last_updated_by := COALESCE(auth.uid(), NEW.last_updated_by, OLD.last_updated_by);
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_cards_stamp_update ON job_cards;
CREATE TRIGGER trg_job_cards_stamp_update
  BEFORE UPDATE ON job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_stamp_job_card_update();


-- ─────────────────────────────────────────────────────
-- (B) case_updates — daily-update / status history
--
-- Every row is an immutable audit entry. The table is append-only from
-- the application's POV; deletions cascade only when the parent case
-- itself is deleted.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_updates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,

  -- The status AT the moment of this update (snapshot, not a FK).
  status           TEXT NOT NULL,

  -- Optional free-text note the operator typed alongside the update.
  note             TEXT,

  -- Who performed the update. We keep BOTH the id (for joining to
  -- auth.users / user_preferences today) AND a denormalised name
  -- snapshot so the timeline still reads correctly after a user row
  -- is deleted or renamed.
  updated_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by_name  TEXT,

  -- Where did this update come from? 'manual' = user submitted via
  -- the daily-update panel, 'trigger' = automatic (status change on
  -- the parent case). Useful for filtering in the UI.
  source           TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'trigger')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_updates_case_time
  ON case_updates(case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_updates_updated_by
  ON case_updates(updated_by);

-- Enable RLS so server-side service role bypasses while clients are
-- controlled by the same policy as job_cards (see migration 003).
ALTER TABLE case_updates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'case_updates' AND policyname = 'case_updates_rw_authenticated'
  ) THEN
    CREATE POLICY case_updates_rw_authenticated ON case_updates
      FOR ALL
      USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- (C) Status-change trigger: any time job_cards.status changes, log
-- it in case_updates automatically. Uses source='trigger' so the UI
-- can distinguish these from manual entries.
--
-- The manual daily-update flow performs an explicit INSERT into
-- case_updates with source='manual' BEFORE updating job_cards. To
-- avoid a duplicate entry in that case, the trigger checks whether
-- a 'manual' row was created in the same transaction within the last
-- second for the same status and skips logging.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_log_job_card_status_change()
RETURNS TRIGGER AS $f$
DECLARE
  v_recent_manual INT;
BEGIN
  -- Only fire when status actually changes.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COUNT(*) INTO v_recent_manual
      FROM case_updates
     WHERE case_id = NEW.id
       AND status  = NEW.status
       AND source  = 'manual'
       AND created_at >= NOW() - INTERVAL '2 seconds';

    IF v_recent_manual = 0 THEN
      INSERT INTO case_updates (case_id, status, note, updated_by, source)
      VALUES (NEW.id, NEW.status, NULL, auth.uid(), 'trigger');
    END IF;
  END IF;
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_cards_log_status ON job_cards;
CREATE TRIGGER trg_job_cards_log_status
  AFTER UPDATE OF status ON job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_job_card_status_change();


-- ─────────────────────────────────────────────────────
-- (D) Seed case_updates with an initial entry for any existing case
-- that has no history yet, so the timeline is never empty.
-- ─────────────────────────────────────────────────────
INSERT INTO case_updates (case_id, status, note, source, created_at)
SELECT jc.id, jc.status, 'Initial state (backfilled)', 'trigger',
       COALESCE(jc.received_at, jc.created_at, NOW())
  FROM job_cards jc
 WHERE NOT EXISTS (
   SELECT 1 FROM case_updates cu WHERE cu.case_id = jc.id
 );
