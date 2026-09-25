CREATE TABLE IF NOT EXISTS workspace_calendar_sources (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  config_json TEXT NOT NULL,
  updated_by_user_id TEXT REFERENCES app_users(id),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_calendar_sources_workspace_id
ON workspace_calendar_sources(workspace_id);

CREATE TABLE IF NOT EXISTS calendar_source_cache (
  source_key TEXT NOT NULL,
  range_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (source_key, range_key)
);

CREATE INDEX IF NOT EXISTS idx_calendar_source_cache_expires_at
ON calendar_source_cache(expires_at);
