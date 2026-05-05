CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT DEFAULT 'orion-workspace',
  status TEXT DEFAULT 'stopped',
  container_id TEXT,
  path TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_accessed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Conversation',
  messages TEXT DEFAULT '[]',
  model TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT
);

-- ══════════════════════════════════════════════════════════════
-- COLLABORATION SYSTEM TABLES
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shared_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  owner_id TEXT,
  share_token TEXT NOT NULL UNIQUE,
  permission TEXT NOT NULL CHECK(permission IN ('viewer', 'editor', 'admin')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
  max_users INTEGER DEFAULT 10,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  last_accessed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  username TEXT NOT NULL,
  permission TEXT NOT NULL CHECK(permission IN ('viewer', 'editor', 'admin')),
  joined_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  is_anonymous INTEGER DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES shared_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS session_activity (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  file_path TEXT,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES shared_sessions(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_sessions_workspace ON shared_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_shared_sessions_token ON shared_sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_sessions_owner ON shared_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_session ON session_activity(session_id);
CREATE INDEX IF NOT EXISTS idx_session_activity_created ON session_activity(created_at);

