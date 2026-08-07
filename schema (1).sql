-- Schéma D1 pour Benkyō Flow.
-- Sert de base pour une future synchronisation cloud (V2).
-- En V1, l'application fonctionne entièrement avec localStorage ;
-- ce schéma et l'API du Worker sont prêts à être branchés ensuite.

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
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_homework_user ON homework(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
