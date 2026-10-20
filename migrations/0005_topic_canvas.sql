PRAGMA foreign_keys = ON;

ALTER TABLE topics
  ADD COLUMN layout_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE topics
  ADD COLUMN pattern_seed TEXT NOT NULL DEFAULT '';

UPDATE topics
SET pattern_seed = id
WHERE pattern_seed = '';

ALTER TABLE topic_fragments
  ADD COLUMN canvas_x REAL NOT NULL DEFAULT 0.08
  CHECK (canvas_x BETWEEN 0 AND 1);

ALTER TABLE topic_fragments
  ADD COLUMN canvas_y REAL NOT NULL DEFAULT 0.08
  CHECK (canvas_y BETWEEN 0 AND 1);

ALTER TABLE topic_fragments
  ADD COLUMN z_index INTEGER NOT NULL DEFAULT 0
  CHECK (z_index >= 0);

ALTER TABLE topic_fragments
  ADD COLUMN shape_variant INTEGER NOT NULL DEFAULT 0
  CHECK (shape_variant BETWEEN 0 AND 15);

UPDATE topic_fragments
SET canvas_x = 0.06 + ((position % 4) * 0.30),
    canvas_y = 0.08 + ((position / 4) * 0.07),
    z_index = position,
    shape_variant = position % 16;
