CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  app TEXT NOT NULL,
  url TEXT,
  domain TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  duration_minutes REAL NOT NULL,
  notes TEXT,
  file_path TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_start_at ON sessions(start_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_app ON sessions(app);
CREATE INDEX IF NOT EXISTS idx_sessions_domain ON sessions(domain);
