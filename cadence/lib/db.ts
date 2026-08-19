import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * SQLite connection (singleton per process).
 *
 * Schema philosophy:
 *  - Users belong to accountability groups via group_members (many-to-many),
 *    so more users/groups can be added without touching code.
 *  - Everything a user creates is owned by user_id. Sharing is *derived*:
 *    other group members only ever see aggregated numbers computed in
 *    lib/analytics.ts / lib/goals.ts — never raw rows.
 *  - Goals are structured (tracking type, target, frequency, minimum) so
 *    progress/streaks/consistency are computed from check-ins, not typed in.
 */

const DB_PATH =
  process.env.CADENCE_DB_PATH || path.join(process.cwd(), "data", "cadence.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  ensureBootstrapGroup(db);
  return db;
}

/**
 * A brand-new database has no groups, and sign-up requires an invite code that
 * matches one — so without this nobody could ever create the first account.
 * On first boot only, create one group whose code comes from
 * CADENCE_INVITE_CODE (or a random one, printed to the logs).
 */
function ensureBootstrapGroup(d: Database.Database) {
  const existing = d.prepare("SELECT COUNT(*) AS n FROM groups").get() as { n: number };
  if (existing.n > 0) return;
  const code =
    (process.env.CADENCE_INVITE_CODE || "").trim() ||
    "JOIN-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const name = process.env.CADENCE_GROUP_NAME?.trim() || "Accountability group";
  d.prepare("INSERT INTO groups (name, invite_code) VALUES (?, ?)").run(name, code);
  console.log(
    `[cadence] Created the first accountability group "${name}". ` +
      `Invite code: ${code} — share it with your group so they can sign up at /join.`
  );
}

function migrate(d: Database.Database) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name  TEXT NOT NULL,
    email         TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'student', -- 'student' | 'working'
    bio           TEXT NOT NULL DEFAULT '',
    timezone      TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
    appearance    TEXT NOT NULL DEFAULT 'system',  -- 'light' | 'dark' | 'system'
    avatar_blob   BLOB,
    avatar_mime   TEXT,
    accent        TEXT NOT NULL DEFAULT 'sage',
    is_demo       INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    left_at   TEXT, -- soft leave: history survives, member disappears from views
    PRIMARY KEY (group_id, user_id)
  );

  -- Task + goal categories. kind lets one list serve both without mixing UIs.
  CREATE TABLE IF NOT EXISTS categories (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name     TEXT NOT NULL,
    color    TEXT NOT NULL DEFAULT '#a8bda8',
    kind     TEXT NOT NULL DEFAULT 'both', -- 'task' | 'goal' | 'both'
    position INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            TEXT NOT NULL,            -- YYYY-MM-DD (user's local day)
    name            TEXT NOT NULL,
    category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    priority        TEXT NOT NULL DEFAULT 'B', -- 'A' | 'B' | 'C'
    planned_minutes INTEGER NOT NULL DEFAULT 30,
    start_min       INTEGER,                  -- minutes from midnight, optional
    end_min         INTEGER,
    completed       INTEGER NOT NULL DEFAULT 0,
    completed_at    TEXT,                     -- ISO datetime; late completion detectable
    notes           TEXT NOT NULL DEFAULT '', -- PRIVATE, never shared
    original_date   TEXT,                     -- set when moved to another day
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);

  -- Intentional non-task time on the 24h timeline (break/rest/travel/…).
  CREATE TABLE IF NOT EXISTS time_blocks (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date      TEXT NOT NULL,
    start_min INTEGER NOT NULL,
    end_min   INTEGER NOT NULL,
    kind      TEXT NOT NULL DEFAULT 'break',
    -- 'break'|'rest'|'travel'|'social'|'personal'|'unplanned'|'other'|'sleep'
    label     TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_blocks_user_date ON time_blocks(user_id, date);

  CREATE TABLE IF NOT EXISTS goals (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title          TEXT NOT NULL,
    why            TEXT NOT NULL DEFAULT '',        -- PRIVATE
    measurement    TEXT NOT NULL DEFAULT '',
    tracking_type  TEXT NOT NULL DEFAULT 'number',
    -- 'number'|'percent'|'boolean'|'time'|'frequency'|'streak'|'quantity'|'custom'
    unit           TEXT NOT NULL DEFAULT '',        -- e.g. 'chapters', 'R', 'min'
    frequency      TEXT NOT NULL DEFAULT 'daily',   -- 'daily'|'weekly'|'monthly'
    period_target  REAL NOT NULL DEFAULT 1,         -- e.g. 3 chapters/day, 4 sessions/week
    minimum_target REAL NOT NULL DEFAULT 0,         -- minimum acceptable per period
    overall_target REAL,                            -- optional cumulative target (e.g. save R10000)
    daily_action   TEXT NOT NULL DEFAULT '',
    evidence       TEXT NOT NULL DEFAULT '',        -- PRIVATE
    start_date     TEXT NOT NULL,                   -- YYYY-MM-DD
    deadline       TEXT,                            -- YYYY-MM-DD, optional
    active_days    TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6', -- daily goals: which weekdays count
    status         TEXT NOT NULL DEFAULT 'active',  -- 'active'|'paused'|'completed'|'archived'
    paused_at      TEXT,
    pauses_json    TEXT NOT NULL DEFAULT '[]',       -- [{from,to?}] excluded periods
    completed_at   TEXT,
    share_progress INTEGER NOT NULL DEFAULT 1,      -- owner can hide a goal entirely
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, status);

  -- One row per goal per local date the user logged progress.
  CREATE TABLE IF NOT EXISTS goal_checkins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id    INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    value      REAL NOT NULL DEFAULT 0,
    note       TEXT NOT NULL DEFAULT '',  -- PRIVATE
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (goal_id, date)
  );
  CREATE INDEX IF NOT EXISTS idx_checkins_goal ON goal_checkins(goal_id, date);

  CREATE TABLE IF NOT EXISTS calendar_events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    date             TEXT NOT NULL,
    end_date         TEXT,
    start_min        INTEGER,
    end_min          INTEGER,
    category         TEXT NOT NULL DEFAULT 'personal',
    -- 'test'|'exam'|'assignment'|'deadline'|'meeting'|'church'|'birthday'|'important'|'personal'|'custom'
    color            TEXT NOT NULL DEFAULT '#a8bda8',
    notes            TEXT NOT NULL DEFAULT '',  -- PRIVATE
    reminder_minutes INTEGER,                   -- minutes before start, null = off
    countdown_slot   INTEGER,                   -- 1..3 → pinned on dashboard
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_events_user_date ON calendar_events(user_id, date);

  CREATE TABLE IF NOT EXISTS timetable_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,           -- 0=Mon .. 6=Sun
    start_min   INTEGER NOT NULL,
    end_min     INTEGER NOT NULL,
    title       TEXT NOT NULL,
    location    TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#b7c4d6',
    source      TEXT NOT NULL DEFAULT 'manual' -- 'manual' | 'import'
  );
  CREATE INDEX IF NOT EXISTS idx_tt_user ON timetable_entries(user_id, day_of_week);

  CREATE TABLE IF NOT EXISTS timetable_uploads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename   TEXT NOT NULL,
    mime       TEXT NOT NULL,
    data       BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS focus_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            TEXT NOT NULL,               -- user's local day it started
    started_at      TEXT NOT NULL,               -- ISO
    ended_at        TEXT,
    planned_minutes INTEGER NOT NULL,
    focus_seconds   INTEGER NOT NULL DEFAULT 0,  -- actual focused time accrued
    status          TEXT NOT NULL DEFAULT 'active',
    -- 'active'|'completed'|'interrupted'|'abandoned'
    interrupt_reason TEXT,   -- 'distracted'|'urgent'|'unplanned_break'|'technical'|'other'
    interrupt_note   TEXT NOT NULL DEFAULT '',
    label            TEXT NOT NULL DEFAULT '',
    config_json      TEXT NOT NULL DEFAULT '{}',
    last_heartbeat   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_focus_user_date ON focus_sessions(user_id, date);

  CREATE TABLE IF NOT EXISTS monthly_reviews (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month        TEXT NOT NULL,               -- YYYY-MM
    answers_json TEXT NOT NULL DEFAULT '{}',  -- ratings + reflections (reflections PRIVATE)
    submitted_at TEXT,
    UNIQUE (user_id, month)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    focus_defaults     TEXT NOT NULL DEFAULT '{}',
    notification_prefs TEXT NOT NULL DEFAULT '{}',
    dashboard_sections TEXT NOT NULL DEFAULT '["today","goals","accountability","upcoming","focus"]'
  );
  `);
}

/** Test helper: use an isolated in-memory DB. */
export function _setTestDb(instance: Database.Database) {
  db = instance;
  migrate(instance);
}
