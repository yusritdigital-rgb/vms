-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('case_ready', 'case_delivered', 'case_overdue', 'workshop_transfer', 'other')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  case_id UUID REFERENCES job_cards(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_case_id ON notifications(case_id);

-- Comment
COMMENT ON TABLE notifications IS 'User notifications for system events';
COMMENT ON COLUMN notifications.type IS 'Notification type: case_ready, case_delivered, case_overdue, workshop_transfer, other';
COMMENT ON COLUMN notifications.expires_at IS 'Optional expiration time for time-sensitive notifications';
