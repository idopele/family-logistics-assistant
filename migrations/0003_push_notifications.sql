CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  device_label TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_success_at TEXT,
  last_failure_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  scheduled_for_utc TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT,
  last_error TEXT,
  UNIQUE(reminder_id, subscription_id, scheduled_for_utc)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_enabled ON push_subscriptions (enabled);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status_time ON notification_deliveries (status, scheduled_for_utc);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_reminder ON notification_deliveries (reminder_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_subscription ON notification_deliveries (subscription_id);
