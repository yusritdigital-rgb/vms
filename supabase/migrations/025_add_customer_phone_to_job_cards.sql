-- =====================================================
-- VMS — 025_add_customer_phone_to_job_cards.sql
-- -----------------------------------------------------
-- Purpose: Add customer_phone field to job_cards table
--          to store customer contact information
-- =====================================================

-- Add customer_phone column to job_cards
ALTER TABLE job_cards
ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Add comment for documentation
COMMENT ON COLUMN job_cards.customer_phone IS 'Customer phone number for contact purposes';
