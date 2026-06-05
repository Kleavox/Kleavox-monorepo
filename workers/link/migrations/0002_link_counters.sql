ALTER TABLE links ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE links ADD COLUMN last_clicked_at TEXT;

CREATE INDEX idx_clicks_clicked_at ON clicks(clicked_at);
CREATE INDEX idx_clicks_country_clicked_at ON clicks(country, clicked_at);
