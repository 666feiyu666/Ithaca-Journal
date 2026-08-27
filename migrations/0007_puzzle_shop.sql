PRAGMA foreign_keys = ON;

ALTER TABLE topics
  ADD COLUMN active_puzzle_id TEXT;

CREATE TABLE user_puzzles (
  user_id TEXT NOT NULL,
  puzzle_id TEXT NOT NULL,
  purchased_at TEXT NOT NULL,
  source_topic_id TEXT,
  PRIMARY KEY (user_id, puzzle_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_topic_id) REFERENCES topics(id) ON DELETE SET NULL
);

CREATE INDEX user_puzzles_purchased_idx
  ON user_puzzles(user_id, purchased_at ASC);
