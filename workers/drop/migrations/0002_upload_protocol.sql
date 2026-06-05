ALTER TABLE drops ADD COLUMN manage_token_hash TEXT;
ALTER TABLE drops ADD COLUMN public_token TEXT;
ALTER TABLE drops ADD COLUMN guest_actor_hash TEXT;
ALTER TABLE drops ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (status IN ('ACTIVE', 'EXHAUSTED', 'DELETING', 'DELETED', 'FAILED'));
ALTER TABLE drops ADD COLUMN completed_at TEXT;
ALTER TABLE drops ADD COLUMN delete_reason TEXT;

ALTER TABLE abuse_reports ADD COLUMN reporter_user_id TEXT;
ALTER TABLE abuse_reports ADD COLUMN updated_at TEXT;

CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  guest_actor_hash TEXT,
  manage_token_hash TEXT NOT NULL UNIQUE,
  public_token TEXT NOT NULL UNIQUE,
  public_token_hash TEXT NOT NULL UNIQUE,
  object_key TEXT NOT NULL UNIQUE,
  r2_upload_id TEXT,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  part_size_bytes INTEGER NOT NULL CHECK (part_size_bytes > 0),
  part_count INTEGER NOT NULL CHECK (part_count > 0),
  password_hash TEXT,
  max_downloads INTEGER,
  expires_at TEXT NOT NULL,
  upload_expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPENING'
    CHECK (
      status IN (
        'OPENING',
        'OPEN',
        'COMPLETING',
        'COMPLETED',
        'ABORTING',
        'ABORTED',
        'FAILED'
      )
    ),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE upload_parts (
  upload_id TEXT NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK (part_number > 0),
  etag TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (upload_id, part_number)
);

CREATE INDEX idx_upload_sessions_owner_status
  ON upload_sessions(owner_user_id, status);
CREATE INDEX idx_upload_sessions_guest_status
  ON upload_sessions(guest_actor_hash, status);
CREATE INDEX idx_upload_sessions_expiry
  ON upload_sessions(status, upload_expires_at);
CREATE INDEX idx_drops_status_expiry ON drops(status, expires_at);
CREATE INDEX idx_drops_manage_token_hash ON drops(manage_token_hash);
