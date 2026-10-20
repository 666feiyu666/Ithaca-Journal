PRAGMA foreign_keys = ON;

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) <= 120),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX topics_user_updated_idx
  ON topics(user_id, updated_at DESC);

CREATE TABLE topic_fragments (
  topic_id TEXT NOT NULL,
  fragment_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (topic_id, fragment_id),
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (fragment_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

CREATE INDEX topic_fragments_fragment_idx
  ON topic_fragments(fragment_id);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) <= 120),
  preface TEXT NOT NULL DEFAULT '',
  content_snapshot TEXT NOT NULL,
  source_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX books_user_created_idx
  ON books(user_id, created_at DESC);

CREATE TABLE journey_letters (
  user_id TEXT NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 21),
  opened_at TEXT NOT NULL,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
