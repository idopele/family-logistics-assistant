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
