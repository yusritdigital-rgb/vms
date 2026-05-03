-- Add payment status fields to misuse_registrations table
-- Run this migration to add payment tracking for misuse registrations

ALTER TABLE misuse_registrations
ADD COLUMN payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'paid', 'rejected')) DEFAULT 'pending',
ADD COLUMN payment_notes TEXT;

-- Add comment to columns (PostgreSQL)
COMMENT ON COLUMN misuse_registrations.payment_status IS 'Payment status: pending, paid, or rejected';
COMMENT ON COLUMN misuse_registrations.payment_notes IS 'Optional notes about payment status';
