-- Demo only: the browser's catalog token can also read these tables.
CREATE TABLE IF NOT EXISTS ml_training_runs (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'interrupted')),
  stage TEXT NOT NULL,
  compare_stock INTEGER NOT NULL CHECK (compare_stock IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  lease_until INTEGER,
  error TEXT,
  report_json TEXT CHECK (report_json IS NULL OR json_valid(report_json))
);
CREATE UNIQUE INDEX IF NOT EXISTS ml_one_pending_run
  ON ml_training_runs ((1)) WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS ml_active_model (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  run_id TEXT NOT NULL REFERENCES ml_training_runs(id),
  model TEXT NOT NULL CHECK (model IN ('linear', 'tree', 'forest', 'baseline')),
  activated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
