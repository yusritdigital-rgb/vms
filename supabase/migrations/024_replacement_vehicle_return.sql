-- Add fields for replacement vehicle return tracking
-- This allows recording the odometer when a replacement vehicle is returned

ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS replacement_return_odometer INTEGER,
  ADD COLUMN IF NOT EXISTS replacement_return_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replacement_return_notes TEXT;

-- Index to find cases with replacement vehicles that haven't been returned yet
CREATE INDEX IF NOT EXISTS idx_job_cards_replacement_not_returned
  ON job_cards (replacement_vehicle_id)
  WHERE replacement_vehicle_id IS NOT NULL
    AND replacement_return_odometer IS NULL;
