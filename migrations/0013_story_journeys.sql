PRAGMA foreign_keys = ON;

CREATE TABLE story_journeys (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed')),
  current_passage TEXT NOT NULL DEFAULT 'PROLOGUE_S01'
    CHECK (length(current_passage) BETWEEN 1 AND 120),
  started_at TEXT NOT NULL,
  last_entered_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
