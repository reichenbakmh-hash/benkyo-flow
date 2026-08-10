-- Schéma D1 pour Benkyō Flow.
-- Comptes utilisateurs (users + sessions) et données synchronisées
-- (subjects, homework, goals, notions, study_sessions), une ligne par
-- utilisateur authentifié.
--
-- IMPORTANT — mise à jour d'une base déjà créée :
-- CREATE TABLE IF NOT EXISTS ne modifie pas une table existante. Si tu as
-- déjà exécuté une version précédente de ce fichier sur ta base D1 distante,
-- lance en plus la migration décrite dans le README (colonne target_date +
-- nouvelles tables notions / study_sessions) avant de redéployer.

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

-- Système de notions (Matière → Chapitre → Notion), volontairement plat
-- (pas d'arborescence en base : chapter est un simple texte associé à la
-- matière, ce qui suffit pour filtrer/regrouper côté interface).
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

-- Sessions d'étude enregistrées manuellement (durée en minutes), utilisées
-- pour les statistiques de temps d'étude de la page Progression.
CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_id TEXT,
  minutes INTEGER NOT NULL,
  session_date TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_homework_user ON homework(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_notions_user ON notions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
