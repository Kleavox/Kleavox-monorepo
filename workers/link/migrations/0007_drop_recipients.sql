CREATE TABLE drop_recipients (
  drop_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  sealed_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (drop_id, recipient_user_id)
);
CREATE INDEX idx_drop_recipients_recipient
  ON drop_recipients(recipient_user_id);
