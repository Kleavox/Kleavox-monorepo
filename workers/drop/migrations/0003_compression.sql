ALTER TABLE drops ADD COLUMN source_size_bytes INTEGER;
ALTER TABLE drops ADD COLUMN storage_encoding TEXT
  CHECK (storage_encoding IS NULL OR storage_encoding = 'gzip');

ALTER TABLE upload_sessions ADD COLUMN source_size_bytes INTEGER;
ALTER TABLE upload_sessions ADD COLUMN storage_encoding TEXT
  CHECK (storage_encoding IS NULL OR storage_encoding = 'gzip');

UPDATE drops SET source_size_bytes = size_bytes
WHERE source_size_bytes IS NULL;

UPDATE upload_sessions SET source_size_bytes = size_bytes
WHERE source_size_bytes IS NULL;
