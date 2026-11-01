-- One row per player per server (scope = "g:<guild id>", or "c:<channel id>" for DMs)
CREATE TABLE IF NOT EXISTS scores (
  scope      TEXT    NOT NULL,
  user_id    TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  best       INTEGER NOT NULL,
  plays      INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope, user_id)
);
CREATE INDEX IF NOT EXISTS idx_scores_board ON scores (scope, best DESC);
