DROP TABLE IF EXISTS uptime_checks;

CREATE TABLE uptime_checks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    node_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    response_ms INTEGER,
    last_checked TEXT,
    alerted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
