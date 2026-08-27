PRAGMA defer_foreign_keys = on;

CREATE TABLE topic_fragments_next (
  topic_id TEXT NOT NULL,
  fragment_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  canvas_x REAL NOT NULL DEFAULT 0.08
    CHECK (canvas_x BETWEEN 0 AND 1),
  canvas_y REAL NOT NULL DEFAULT 0.08
    CHECK (canvas_y BETWEEN 0 AND 1),
  z_index INTEGER NOT NULL DEFAULT 0
    CHECK (z_index >= 0),
  shape_variant INTEGER NOT NULL DEFAULT 0
    CHECK (shape_variant BETWEEN 0 AND 49),
  PRIMARY KEY (topic_id, fragment_id),
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (fragment_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

INSERT INTO topic_fragments_next (
  topic_id,
  fragment_id,
  position,
  canvas_x,
  canvas_y,
  z_index,
  shape_variant
)
SELECT
  topic_id,
  fragment_id,
  position,
  canvas_x,
  canvas_y,
  z_index,
  shape_variant
FROM topic_fragments;

DROP TABLE topic_fragments;
ALTER TABLE topic_fragments_next RENAME TO topic_fragments;

CREATE INDEX topic_fragments_fragment_idx
  ON topic_fragments(fragment_id);

PRAGMA defer_foreign_keys = off;
