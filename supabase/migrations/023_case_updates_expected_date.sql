-- =====================================================
-- VMS — 023_case_updates_expected_date.sql
-- ----------------------------------------------------------
-- Snapshot the planned completion date alongside each status update.
--
-- New behaviour (see app code):
--   • Create Case no longer asks for an expected completion date.
--   • The field becomes required ONLY when an officer changes the
--     case status to one of the in-progress states:
--         تحت الاصلاح الميكانيكي
--         تحت اصلاح الهيكل
--         تحت الدهان
--   • The new value is written to job_cards.expected_completion_date
--     (current state) AND to case_updates.expected_completion_date
--     (history snapshot) atomically, alongside status / updated_by /
--     created_at that the row already carries.
--
-- This column is nullable — backfilled rows and updates that don't
-- touch the deadline simply leave it NULL.
-- =====================================================

ALTER TABLE public.case_updates
  ADD COLUMN IF NOT EXISTS expected_completion_date DATE;
