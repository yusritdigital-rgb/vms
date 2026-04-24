-- =====================================================
-- VMS — 017_appointments_customer_email.sql
-- Adds customer_email column to appointments so the system can
-- optionally send a confirmation email on creation.
-- Fully additive and idempotent.
-- =====================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_email TEXT;
