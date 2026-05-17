DROP TABLE IF EXISTS uptime_logs;
DROP TABLE IF EXISTS uptime_checks;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS short_links;

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE uptime_checks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_checked TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE uptime_logs (
    id TEXT PRIMARY KEY,
    check_id TEXT NOT NULL REFERENCES uptime_checks(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    response_ms INTEGER,
    checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE short_links (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    target_url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
