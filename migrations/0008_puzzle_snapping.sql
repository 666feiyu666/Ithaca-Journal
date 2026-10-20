PRAGMA foreign_keys = ON;

ALTER TABLE topic_fragments
  ADD COLUMN is_snapped INTEGER NOT NULL DEFAULT 0
  CHECK (is_snapped IN (0, 1));
