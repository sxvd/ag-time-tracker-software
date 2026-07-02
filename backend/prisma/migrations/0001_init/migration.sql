CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  team TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id),
  name TEXT NOT NULL
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  client_id TEXT REFERENCES clients(id),
  project_id TEXT REFERENCES projects(id),
  estimate_minutes INTEGER,
  owner_id TEXT NOT NULL REFERENCES users(id),
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE task_members (
  task_id TEXT NOT NULL REFERENCES tasks(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  duration_seconds INTEGER NOT NULL,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  idle_seconds INTEGER NOT NULL DEFAULT 0,
  context_switches INTEGER NOT NULL DEFAULT 0,
  location_label TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user_started ON time_entries(user_id, started_at);
CREATE INDEX idx_time_entries_task ON time_entries(task_id);

CREATE TABLE entry_pauses (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES time_entries(id),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NOT NULL,
  duration_seconds INTEGER NOT NULL
);

CREATE TABLE entry_feedback (
  entry_id TEXT PRIMARY KEY REFERENCES time_entries(id),
  flow_quality TEXT NOT NULL,
  efficiency_feel TEXT NOT NULL,
  energy TEXT NOT NULL,
  note TEXT
);

CREATE TABLE blockers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_default BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE entry_blockers (
  entry_id TEXT NOT NULL REFERENCES time_entries(id),
  blocker_id TEXT NOT NULL REFERENCES blockers(id),
  PRIMARY KEY (entry_id, blocker_id)
);

CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  idle_threshold_minutes INTEGER NOT NULL DEFAULT 5,
  nudge_cadence_minutes INTEGER NOT NULL DEFAULT 90,
  breezy_verbosity TEXT NOT NULL DEFAULT 'gentle',
  location_enabled BOOLEAN NOT NULL DEFAULT false,
  activity_enabled BOOLEAN NOT NULL DEFAULT true,
  location_labels JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE breezy_nudges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  related_entry_id TEXT REFERENCES time_entries(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  shown_at TIMESTAMP NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP
);

CREATE TABLE breezy_days (
  user_id TEXT NOT NULL REFERENCES users(id),
  date DATE NOT NULL,
  breezy_mood TEXT NOT NULL,
  air_clarity_score INTEGER NOT NULL,
  PRIMARY KEY (user_id, date)
);

CREATE TABLE medals (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE user_medals (
  user_id TEXT NOT NULL REFERENCES users(id),
  medal_id TEXT NOT NULL REFERENCES medals(id),
  awarded_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, medal_id)
);

CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  format TEXT NOT NULL,
  date_from TIMESTAMP,
  date_to TIMESTAMP,
  exported_at TIMESTAMP NOT NULL DEFAULT now()
);
