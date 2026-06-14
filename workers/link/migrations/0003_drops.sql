CREATE TABLE drops (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  public_token_hash TEXT NOT NULL UNIQUE,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  password_hash TEXT,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE abuse_reports (
  id TEXT PRIMARY KEY,
  drop_id TEXT REFERENCES drops(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'RESOLVED', 'REJECTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX idx_drops_owner_user_id ON drops(owner_user_id);
CREATE INDEX idx_drops_expires_at ON drops(expires_at);
CREATE INDEX idx_drops_deleted_at ON drops(deleted_at);
CREATE INDEX idx_abuse_reports_status_created_at
  ON abuse_reports(status, created_at);
