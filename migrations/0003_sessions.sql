CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    github_login TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
