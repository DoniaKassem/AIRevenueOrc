-- =============================================
-- Real-time Notification System Schema
-- Priority 1 Launch Blocker Feature
-- =============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- NOTIFICATIONS
-- =============================================

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,
  event_id UUID,

  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  icon TEXT,
  image_url TEXT,

  -- Behavior
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  action_url TEXT,
  action_label TEXT,

  -- Grouping
  group_key TEXT,

  -- Status
  status TEXT CHECK (status IN ('unread', 'read', 'archived', 'snoozed')) DEFAULT 'unread',
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_org ON notifications(organization_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_event_type ON notifications(event_type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_notifications_snoozed ON notifications(snoozed_until) WHERE status = 'snoozed';

-- Composite index for common queries
CREATE INDEX idx_notifications_user_status_created ON notifications(user_id, status, created_at DESC);

-- =============================================
-- NOTIFICATION PREFERENCES
-- =============================================

-- Notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Event-specific settings
  event_type TEXT NOT NULL,

  -- Channel preferences (stored as JSONB for flexibility)
  channels JSONB NOT NULL DEFAULT '{
    "inApp": {
      "enabled": true,
      "sound": false,
      "desktop": false
    },
    "email": {
      "enabled": true,
      "frequency": "daily",
      "quietHoursStart": "22:00",
      "quietHoursEnd": "08:00"
    },
    "push": {
      "enabled": false
    },
    "sms": {
      "enabled": false
    }
  }'::jsonb,

  -- Priority filter
  min_priority TEXT CHECK (min_priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'low',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, event_type)
);

CREATE INDEX idx_preferences_user ON notification_preferences(user_id);
CREATE INDEX idx_preferences_event_type ON notification_preferences(event_type);

-- =============================================
-- NOTIFICATION DELIVERIES
-- =============================================

-- Delivery tracking table
CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT CHECK (channel IN ('in_app', 'email', 'push', 'sms')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'clicked', 'failed')) DEFAULT 'pending',

  -- Delivery timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Failure tracking
  attempts INTEGER DEFAULT 0,
  last_error TEXT,

  -- Channel-specific metadata
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX idx_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX idx_deliveries_status ON notification_deliveries(status);
CREATE INDEX idx_deliveries_created_at ON notification_deliveries(created_at DESC);

-- Composite index for pending deliveries
CREATE INDEX idx_deliveries_pending ON notification_deliveries(channel, status) WHERE status = 'pending';

-- =============================================
-- NOTIFICATION BATCHES (for digest emails)
-- =============================================

-- Batches table
CREATE TABLE notification_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency TEXT CHECK (frequency IN ('hourly', 'daily', 'weekly')) NOT NULL,
  notification_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_batches_user ON notification_batches(user_id);
CREATE INDEX idx_batches_status ON notification_batches(status);
CREATE INDEX idx_batches_scheduled ON notification_batches(scheduled_for) WHERE status = 'pending';

-- =============================================
-- PUSH SUBSCRIPTIONS
-- =============================================

-- Push subscriptions table
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Web Push subscription
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,

  -- Device info
  user_agent TEXT,
  device_name TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_used TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subs_active ON push_subscriptions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_push_subs_endpoint ON push_subscriptions(endpoint);

-- =============================================
-- EMAIL BOUNCES
-- =============================================

-- Email bounce tracking
CREATE TABLE email_bounces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  bounce_type TEXT CHECK (bounce_type IN ('soft', 'hard')) DEFAULT 'hard',
  reason TEXT,
  bounced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bounces_email ON email_bounces(email);
CREATE INDEX idx_bounces_bounced_at ON email_bounces(bounced_at DESC);

-- =============================================
-- USER PRESENCE
-- =============================================

-- User presence tracking (for WebSocket)
CREATE TABLE user_presence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('online', 'away', 'offline')) DEFAULT 'offline',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  connections INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_presence_org ON user_presence(organization_id);
CREATE INDEX idx_presence_status ON user_presence(status);
CREATE INDEX idx_presence_last_seen ON user_presence(last_seen DESC);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-archive old notifications
CREATE OR REPLACE FUNCTION auto_archive_notifications()
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET status = 'archived',
      archived_at = NOW()
  WHERE status = 'read'
    AND read_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to unsnooze notifications
CREATE OR REPLACE FUNCTION unsnooze_notifications()
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET status = 'unread',
      snoozed_until = NULL
  WHERE status = 'snoozed'
    AND snoozed_until IS NOT NULL
    AND snoozed_until <= NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamp on preference changes
CREATE TRIGGER trigger_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- Update timestamp on presence changes
CREATE TRIGGER trigger_presence_updated_at
  BEFORE UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_timestamp();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can only see their own
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Service role only

CREATE POLICY "Service can delete notifications"
  ON notifications FOR DELETE
  USING (true); -- Service role only

-- Preferences: Users can manage their own
CREATE POLICY "Users can manage their own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Deliveries: Service role only
CREATE POLICY "Service can manage deliveries"
  ON notification_deliveries FOR ALL
  USING (true); -- Service role only

-- Batches: Service role only
CREATE POLICY "Service can manage batches"
  ON notification_batches FOR ALL
  USING (true); -- Service role only

-- Push subscriptions: Users can manage their own
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Email bounces: Service role only
CREATE POLICY "Service can manage bounces"
  ON email_bounces FOR ALL
  USING (true); -- Service role only

-- Presence: Users in same organization can view
CREATE POLICY "Users can view presence in their organization"
  ON user_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = user_presence.organization_id
    )
  );

CREATE POLICY "Service can manage presence"
  ON user_presence FOR ALL
  USING (true); -- Service role only

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- GIN index for JSONB metadata search
CREATE INDEX idx_notifications_metadata_gin ON notifications USING gin(metadata);

-- Partial indexes for active records
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE status = 'unread';
CREATE INDEX idx_deliveries_failed ON notification_deliveries(notification_id) WHERE status = 'failed';

-- =============================================
-- STATISTICS
-- =============================================

-- Create view for notification analytics
CREATE VIEW notification_stats AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE status = 'unread') as unread_count,
  COUNT(*) FILTER (WHERE status = 'read') as read_count,
  COUNT(*) FILTER (WHERE status = 'archived') as archived_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h_count,
  COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
  MAX(created_at) as last_notification_at
FROM notifications
GROUP BY user_id;

-- Create view for delivery analytics
CREATE VIEW delivery_stats AS
SELECT
  channel,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at))) as avg_delivery_time_seconds,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count
FROM notification_deliveries
WHERE sent_at IS NOT NULL
GROUP BY channel, status;

-- =============================================
-- INITIAL DATA
-- =============================================

-- No initial data needed - preferences are created on-demand

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE notifications IS 'Stores all notifications sent to users';
COMMENT ON TABLE notification_preferences IS 'User preferences for how they want to receive notifications';
COMMENT ON TABLE notification_deliveries IS 'Tracks delivery status of notifications across all channels';
COMMENT ON TABLE notification_batches IS 'Batches notifications for digest emails';
COMMENT ON TABLE push_subscriptions IS 'Web Push API subscriptions for browser notifications';
COMMENT ON TABLE email_bounces IS 'Tracks email bounces to prevent sending to invalid addresses';
COMMENT ON TABLE user_presence IS 'Real-time presence tracking for users (online/away/offline)';

COMMENT ON COLUMN notifications.group_key IS 'Used to collapse similar notifications (e.g., multiple emails from same person)';
COMMENT ON COLUMN notifications.expires_at IS 'Notifications expire after this time and are auto-deleted';
COMMENT ON COLUMN notification_preferences.min_priority IS 'Only send notifications with priority >= this level';
COMMENT ON COLUMN notification_deliveries.attempts IS 'Number of delivery attempts (for retry logic)';
COMMENT ON COLUMN push_subscriptions.endpoint IS 'Web Push API endpoint URL';
COMMENT ON COLUMN push_subscriptions.keys IS 'Web Push API encryption keys (p256dh and auth)';
