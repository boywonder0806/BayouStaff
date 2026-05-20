-- Blue Bayou Staff Portal — PostgreSQL Schema
-- Run once: psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS employees (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'crew_member', -- 'crew_member' | 'manager' | 'sysadmin'
  department    TEXT,
  departments   TEXT[] NOT NULL DEFAULT '{}',
  position      TEXT,
  avatar        TEXT,
  phone         TEXT,
  hire_date     DATE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shifts (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  department  TEXT,
  position    TEXT,
  location    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draft_shifts (
  id          SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  department  TEXT,
  position    TEXT,
  location    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  author_id     INTEGER REFERENCES employees(id),
  author_name   TEXT NOT NULL,
  author_avatar TEXT,
  department    TEXT,
  priority      TEXT NOT NULL DEFAULT 'normal',
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id         SERIAL PRIMARY KEY,
  name       TEXT,
  type       TEXT NOT NULL DEFAULT 'direct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  employee_id     INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, employee_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES employees(id),
  text            TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_employee_date       ON shifts(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_draft_shifts_employee_date ON draft_shifts(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_date                ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_draft_shifts_date          ON draft_shifts(date);
CREATE INDEX IF NOT EXISTS idx_messages_conversation      ON messages(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_announcements_date         ON announcements(date DESC);

CREATE TABLE IF NOT EXISTS department_roles (
  id          SERIAL PRIMARY KEY,
  department  TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INT  NOT NULL DEFAULT 0,
  UNIQUE (department, name)
);
CREATE INDEX IF NOT EXISTS idx_department_roles_dept ON department_roles(department);
