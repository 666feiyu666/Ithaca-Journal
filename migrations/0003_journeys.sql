PRAGMA foreign_keys = ON;

CREATE TABLE journeys (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  current_day INTEGER NOT NULL DEFAULT 1
    CHECK (current_day BETWEEN 1 AND 21),
  started_at TEXT NOT NULL,
  last_entered_at TEXT NOT NULL,
  last_progress_date TEXT NOT NULL,
  intro_completed_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
