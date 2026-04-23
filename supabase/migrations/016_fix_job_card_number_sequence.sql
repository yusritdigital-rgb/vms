-- =====================================================
-- VMS — 016_fix_job_card_number_sequence.sql
-- -----------------------------------------------------
-- Fixes two bugs in the original auto-number trigger:
--
--   1. `regexp_replace(num, '\D', '', 'g')` strips EVERY non-digit,
--      so `JC-2026-0003` collapses to the int `20260003` (year
--      digits included). The very next insert then produces
--      `JC-2026-20260004` — the "JC-2026-2026" style doubling.
--
--   2. Even after fixing the trigger, existing rows may carry the
--      broken numbers, so `MAX()` keeps pulling a corrupt value.
--
-- Fix strategy:
--   A. Renumber every existing `job_cards` row cleanly, per year,
--      ordered by `created_at`. Format: JC-YYYY-NNNN (4-digit pad).
--   B. Reinstall the trigger with a correct suffix parser that
--      ONLY considers well-formed `JC-YYYY-<1..6 digits>` numbers.
--
-- Idempotent and side-effect-only on `job_cards`.
-- =====================================================


-- ─────────────────────────────────────────────────────
-- A) Renumber existing rows in a single transaction.
--    Step 1: suffix current numbers so the UNIQUE constraint
--            doesn't trip while we assign new ones.
--    Step 2: assign fresh JC-YYYY-NNNN per year by created_at.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_cards'
  ) THEN
    RETURN;
  END IF;

  -- Step 1
  UPDATE public.job_cards
     SET job_card_number = job_card_number || '__reseq'
   WHERE job_card_number IS NOT NULL
     AND job_card_number NOT LIKE '%__reseq';

  -- Step 2
  WITH numbered AS (
    SELECT id,
           'JC-' || EXTRACT(YEAR FROM created_at)::INT::TEXT || '-' ||
           LPAD(
             ROW_NUMBER() OVER (
               PARTITION BY EXTRACT(YEAR FROM created_at)
               ORDER BY created_at ASC, id ASC
             )::TEXT,
             4, '0'
           ) AS new_num
      FROM public.job_cards
  )
  UPDATE public.job_cards j
     SET job_card_number = n.new_num
    FROM numbered n
   WHERE n.id = j.id;
END $$;


-- ─────────────────────────────────────────────────────
-- B) Reinstall the trigger with a correct suffix parser.
--    The regex `^JC-YYYY-([0-9]{1,6})$` guarantees we only
--    parse legitimate sequence numbers; any malformed legacy
--    value is ignored so it can't poison MAX().
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_autonumber_job_card()
RETURNS TRIGGER AS $f$
DECLARE
  v_year  TEXT := EXTRACT(YEAR FROM NOW())::INT::TEXT;
  v_next  INT;
  v_tries INT := 0;
  v_cand  TEXT;
BEGIN
  IF NEW.job_card_number IS NOT NULL AND NEW.job_card_number <> '' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
           MAX(
             (regexp_match(
                job_card_number,
                ('^JC-' || v_year || '-([0-9]{1,6})$')
             ))[1]::INT
           ),
           0
         )
    INTO v_next
    FROM public.job_cards
   WHERE job_card_number ~ ('^JC-' || v_year || '-[0-9]{1,6}$');

  LOOP
    v_next  := v_next + 1;
    v_tries := v_tries + 1;
    v_cand  := 'JC-' || v_year || '-' || LPAD(v_next::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (
                SELECT 1 FROM public.job_cards
                 WHERE job_card_number = v_cand
              )
           OR v_tries > 50;
  END LOOP;

  NEW.job_card_number := v_cand;
  RETURN NEW;
END;
$f$ LANGUAGE plpgsql;

-- (Re)attach the BEFORE INSERT trigger.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'job_cards'
  ) THEN
    DROP TRIGGER IF EXISTS trg_autonumber_job_card ON public.job_cards;
    CREATE TRIGGER trg_autonumber_job_card
      BEFORE INSERT ON public.job_cards
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_autonumber_job_card();
  END IF;
END $$;


-- ─────────────────────────────────────────────────────
-- C) Force PostgREST to refresh its schema cache so the
--    column changes above are visible without a restart.
-- ─────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
