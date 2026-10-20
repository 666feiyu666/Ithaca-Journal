PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL UNIQUE CHECK (length(code_hash) = 64),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by_user_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX invites_email_code_idx ON invites(email, code_hash);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) <= 120),
  body TEXT NOT NULL,
  body_format TEXT NOT NULL DEFAULT 'plain'
    CHECK (body_format IN ('plain', 'markdown', 'ciphertext')),
  encryption_version INTEGER NOT NULL DEFAULT 0
    CHECK (encryption_version >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX journal_entries_user_updated_idx
  ON journal_entries(user_id, updated_at DESC);
