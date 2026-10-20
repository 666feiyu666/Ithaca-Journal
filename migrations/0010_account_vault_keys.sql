PRAGMA foreign_keys = ON;

CREATE TABLE account_vault_keys (
  user_id TEXT PRIMARY KEY,
  envelope_version INTEGER NOT NULL DEFAULT 1
    CHECK (envelope_version = 1),
  algorithm TEXT NOT NULL DEFAULT 'AES-GCM-256'
    CHECK (algorithm = 'AES-GCM-256'),
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
