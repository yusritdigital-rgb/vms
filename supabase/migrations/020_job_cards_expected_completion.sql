-- =====================================================
-- VMS — 020_job_cards_expected_completion.sql
-- ----------------------------------------------------------
-- Adds an "expected completion date" column to `job_cards` so the
-- workshop can track delays. The column is nullable (legacy rows
-- created before this migration must remain valid). Application
-- layer (Create Case form) treats it as required for new rows.
--
-- Idempotent — safe to re-run.
-- =====================================================

ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS expected_completion_date DATE;

-- Useful when sorting / filtering open cases by overdue-ness.
CREATE INDEX IF NOT EXISTS idx_job_cards_expected_completion_date
  ON public.job_cards (expected_completion_date);
