CREATE TABLE IF NOT EXISTS custom_children (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_events (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_exceptions (
  event_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, occurrence_date)
);

CREATE TABLE IF NOT EXISTS transportation_plans (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_id, occurrence_date)
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_custom_events_child_id ON custom_events (child_id);
CREATE INDEX IF NOT EXISTS idx_event_exceptions_event_id ON event_exceptions (event_id);
CREATE INDEX IF NOT EXISTS idx_event_exceptions_occurrence_date ON event_exceptions (occurrence_date);
CREATE INDEX IF NOT EXISTS idx_transportation_plans_event_id ON transportation_plans (event_id);
CREATE INDEX IF NOT EXISTS idx_transportation_plans_occurrence_date ON transportation_plans (occurrence_date);
