PRAGMA foreign_keys = ON;

CREATE TABLE privacy_profiles (
  user_id TEXT PRIMARY KEY,
  profile_version INTEGER NOT NULL DEFAULT 1
    CHECK (profile_version = 1),
  kdf_name TEXT NOT NULL
    CHECK (kdf_name = 'PBKDF2-SHA256'),
  kdf_iterations INTEGER NOT NULL
    CHECK (kdf_iterations >= 600000),
  salt TEXT NOT NULL,
  verifier_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE topics
  ADD COLUMN encryption_version INTEGER NOT NULL DEFAULT 0
  CHECK (encryption_version >= 0);

ALTER TABLE books
  ADD COLUMN encryption_version INTEGER NOT NULL DEFAULT 0
  CHECK (encryption_version >= 0);
