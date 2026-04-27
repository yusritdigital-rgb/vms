-- =====================================================
-- VMS — 022_drop_appointments_mileage.sql
-- ----------------------------------------------------------
-- Odometer/mileage is no longer captured at appointment time. The
-- canonical reading is the one stamped at case creation — see the
-- `vehicle_odometer_readings` table introduced in migration 021.
--
-- This migration removes the now-unused column. It is destructive
-- (drops historical mileage entered through the old appointments form)
-- but the data is not used by any current report or workflow.
--
-- Idempotent — safe to re-run.
-- =====================================================

ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS mileage;
