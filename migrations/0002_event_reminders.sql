CREATE TABLE IF NOT EXISTS event_reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  minutes_before INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_event_reminders_event_id ON event_reminders (event_id);
CREATE INDEX IF NOT EXISTS idx_event_reminders_occurrence_date ON event_reminders (occurrence_date);
