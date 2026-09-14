CREATE TABLE IF NOT EXISTS shared_views (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  all_schedule_members INTEGER NOT NULL DEFAULT 0 CHECK (all_schedule_members IN (0, 1)),
  all_categories INTEGER NOT NULL DEFAULT 0 CHECK (all_categories IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by_user_id TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_views_workspace_active
ON shared_views(workspace_id, active);

CREATE TABLE IF NOT EXISTS shared_view_users (
  id TEXT PRIMARY KEY,
  shared_view_id TEXT NOT NULL REFERENCES shared_views(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  UNIQUE (shared_view_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_view_users_user_id
ON shared_view_users(user_id);

CREATE TABLE IF NOT EXISTS shared_view_schedule_members (
  shared_view_id TEXT NOT NULL REFERENCES shared_views(id) ON DELETE CASCADE,
  schedule_member_id TEXT NOT NULL,
  PRIMARY KEY (shared_view_id, schedule_member_id)
);

CREATE TABLE IF NOT EXISTS shared_view_categories (
  shared_view_id TEXT NOT NULL REFERENCES shared_views(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  PRIMARY KEY (shared_view_id, category)
);

CREATE TABLE IF NOT EXISTS shared_view_permissions (
  shared_view_id TEXT NOT NULL REFERENCES shared_views(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (
    permission IN (
      'view_schedule',
      'edit_schedule',
      'view_transportation',
      'edit_transportation',
      'view_contacts',
      'receive_notifications'
    )
  ),
  PRIMARY KEY (shared_view_id, permission)
);
