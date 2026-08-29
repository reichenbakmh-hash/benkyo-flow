CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS homework (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  title TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  notes TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  title TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  chapter TEXT DEFAULT '',
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'non_etudiee',
  last_reviewed_at INTEGER,
  next_review_at TEXT,
  note TEXT DEFAULT '',
  source TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  minutes INTEGER NOT NULL,
  session_date TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_homework_user ON homework(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_notions_user ON notions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
