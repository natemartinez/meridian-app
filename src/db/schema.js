module.exports = `
CREATE TABLE IF NOT EXISTS nova_sessions (
  id TEXT PRIMARY KEY,
  program TEXT NOT NULL,
  date TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  raw_messages TEXT,
  summary TEXT,
  energy_level INTEGER,
  tags TEXT
);

CREATE TABLE IF NOT EXISTS nova_insights (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES nova_sessions(id),
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence REAL DEFAULT 0.8,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS nova_checkins (
  id TEXT PRIMARY KEY,
  asked_at INTEGER NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  context_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS nova_behavioral (
  date TEXT PRIMARY KEY,
  tasks_generated INTEGER DEFAULT 0,
  tasks_accepted INTEGER DEFAULT 0,
  tasks_rejected INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  sync_score_start INTEGER,
  sync_score_end INTEGER,
  briefing_done INTEGER DEFAULT 0,
  regroup_done INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS knowledge_pool (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  insight_id TEXT REFERENCES nova_insights(id)
);
`;
