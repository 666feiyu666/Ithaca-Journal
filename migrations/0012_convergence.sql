PRAGMA foreign_keys = ON;

-- 0011 的 category CHECK 已经发布，SQLite 不能原位扩展该约束。
-- writing_category 从本迁移起成为权威列；category 作为旧 Worker 的回滚兼容镜像保留。
ALTER TABLE journal_entries
  ADD COLUMN writing_category TEXT
  CHECK (
    writing_category IS NULL
    OR writing_category IN ('fragment', 'theme', 'letter', 'book', 'journal')
  );

UPDATE journal_entries
SET writing_category = category;

CREATE INDEX journal_entries_user_writing_category_updated_idx
  ON journal_entries(user_id, writing_category, updated_at DESC);

CREATE TABLE achievements (
  user_id TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, achievement_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX achievements_user_unlocked_idx
  ON achievements(user_id, unlocked_at DESC);
