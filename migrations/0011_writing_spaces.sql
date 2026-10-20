PRAGMA foreign_keys = ON;

ALTER TABLE journal_entries
  ADD COLUMN category TEXT DEFAULT 'fragment'
  CHECK (category IS NULL OR category IN ('fragment', 'theme', 'letter', 'book'));

ALTER TABLE journal_entries
  ADD COLUMN source_topic_id TEXT
  REFERENCES topics(id) ON DELETE SET NULL;

ALTER TABLE journal_entries
  ADD COLUMN source_letter_day INTEGER
  CHECK (source_letter_day IS NULL OR source_letter_day BETWEEN 1 AND 21);

UPDATE journal_entries
SET category = 'fragment'
WHERE category IS NULL;

CREATE INDEX journal_entries_user_category_updated_idx
  ON journal_entries(user_id, category, updated_at DESC);

CREATE INDEX journal_entries_source_topic_idx
  ON journal_entries(source_topic_id);

ALTER TABLE books
  ADD COLUMN source_entry_id TEXT
  REFERENCES journal_entries(id) ON DELETE SET NULL;

CREATE INDEX books_source_entry_idx
  ON books(source_entry_id);

CREATE TABLE sent_letters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_entry_id TEXT,
  title TEXT NOT NULL,
  content_snapshot TEXT NOT NULL,
  encryption_version INTEGER NOT NULL DEFAULT 1
    CHECK (encryption_version >= 1),
  sent_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL
);

CREATE INDEX sent_letters_user_sent_idx
  ON sent_letters(user_id, sent_at DESC);

CREATE INDEX sent_letters_source_entry_idx
  ON sent_letters(source_entry_id);
