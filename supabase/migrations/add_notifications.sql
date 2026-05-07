-- Alter existing notifications table to match API schema
-- Add new columns
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title_ar TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body_ar TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body_en TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Drop old columns
ALTER TABLE notifications DROP COLUMN IF EXISTS user_id;
ALTER TABLE notifications DROP COLUMN IF EXISTS title;
ALTER TABLE notifications DROP COLUMN IF EXISTS message;
ALTER TABLE notifications DROP COLUMN IF EXISTS case_id;

-- Update type constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('case_ready', 'case_delivered', 'case_overdue', 'workshop_transfer', 'other'));

-- Update indexes
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_case_id;
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_reference_id ON notifications(reference_id);

-- Update comments
COMMENT ON TABLE notifications IS 'Company notifications for system events';
COMMENT ON COLUMN notifications.type IS 'Notification type: case_ready, case_delivered, case_overdue, workshop_transfer, other';
COMMENT ON COLUMN notifications.expires_at IS 'Optional expiration time for time-sensitive notifications';
COMMENT ON COLUMN notifications.reference_id IS 'Optional reference ID for deduplication (e.g., case_id)';

-- Add job_card_number to invoices table for linking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_card_number TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_job_card_number ON invoices(job_card_number);
