CREATE TABLE links (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  target_url TEXT NOT NULL,
  password_hash TEXT,
  expires_at TEXT,
  disabled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  country TEXT,
  browser TEXT,
  operating_system TEXT,
  device_type TEXT,
  referrer_host TEXT,
  clicked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  link_id TEXT REFERENCES links(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'RESOLVED', 'REJECTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX idx_links_user_id ON links(user_id);
CREATE INDEX idx_links_expires_at ON links(expires_at);
CREATE INDEX idx_clicks_link_id_clicked_at ON clicks(link_id, clicked_at);
CREATE INDEX idx_reports_status_created_at ON reports(status, created_at);
