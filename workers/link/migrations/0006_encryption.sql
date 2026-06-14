ALTER TABLE drops ADD COLUMN encryption TEXT
  CHECK (encryption IS NULL OR encryption = 'aes-256-gcm');
ALTER TABLE upload_sessions ADD COLUMN encryption TEXT
  CHECK (encryption IS NULL OR encryption = 'aes-256-gcm');
