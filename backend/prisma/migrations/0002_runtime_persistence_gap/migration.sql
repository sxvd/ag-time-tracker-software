ALTER TABLE task_members
  ADD COLUMN role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN invited_by_user_id TEXT REFERENCES users(id),
  ADD COLUMN joined_at TIMESTAMP NOT NULL DEFAULT now();

CREATE INDEX idx_task_members_user ON task_members(user_id);

ALTER TABLE time_entries
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN is_edited BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_time_entries_user_ended ON time_entries(user_id, ended_at);

ALTER TABLE settings
  ADD COLUMN muted BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_sessions_user_active ON auth_sessions(user_id, revoked_at, expires_at);

CREATE TABLE task_invites (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  recipient_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  responded_at TIMESTAMP
);

CREATE INDEX idx_task_invites_sender ON task_invites(sender_id);
CREATE INDEX idx_task_invites_recipient_status ON task_invites(recipient_id, status);
CREATE INDEX idx_task_invites_task_recipient_status ON task_invites(task_id, recipient_id, status);

CREATE TABLE tracking_presence (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  entry_id TEXT NOT NULL UNIQUE REFERENCES time_entries(id),
  started_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_presence_task ON tracking_presence(task_id);

CREATE TABLE entry_audit_events (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES time_entries(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  changes JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_entry_audit_events_entry_created ON entry_audit_events(entry_id, created_at);
CREATE INDEX idx_entry_audit_events_user_created ON entry_audit_events(user_id, created_at);
