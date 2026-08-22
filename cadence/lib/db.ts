import { createClient, type Client, type InArgs, type InStatement } from "@libsql/client";
import path from "path";
import fs from "fs";
import crypto from "crypto";

/**
 * Database access (libSQL / SQLite).
 *
 * One codebase, two backends, identical SQL:
 *   - locally, a plain SQLite file (`file:./data/cadence.db`)
 *   - in production, Turso — hosted SQLite reached over HTTP, so the data lives
 *     independently of whatever server happens to be running the app and is
 *     never tied to a disposable filesystem.
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

let client: Client | null = null;
let ready: Promise<void> | null = null;

function databaseUrl(): string {
  const remote = process.env.TURSO_DATABASE_URL?.trim();
  if (remote) return remote;
  const file = process.env.CADENCE_DB_PATH || path.join(process.cwd(), "data", "cadence.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return "file:" + file;
}

export function getClient(): Client {
  if (!client) {
    client = createClient({
      url: databaseUrl(),
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

/** Applies the schema once per process. Every query below awaits this. */
export function initDb(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await getClient().executeMultiple(SCHEMA);
      await addMissingColumns();
      await ensureBootstrapGroup();
    })().catch((err) => {
      ready = null; // let a later request retry rather than wedging the process
      throw err;
    });
  }
  return ready;
}

/** libSQL rows are array-like; hand plain objects to the rest of the app. */
function plain<T>(rows: unknown[]): T[] {
  return rows.map((r) => ({ ...(r as object) })) as T[];
}

export async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  await initDb();
  const rs = await getClient().execute({ sql, args });
  return plain<T>(rs.rows);
}

export async function get<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  const rows = await all<T>(sql, args);
  return rows[0];
}

export async function run(
  sql: string,
  args: InArgs = []
): Promise<{ lastInsertRowid: number; changes: number }> {
  await initDb();
  const rs = await getClient().execute({ sql, args });
  return {
    lastInsertRowid: rs.lastInsertRowid !== undefined ? Number(rs.lastInsertRowid) : 0,
    changes: Number(rs.rowsAffected ?? 0),
  };
}

/** Runs statements atomically. Use for multi-row writes with no dependencies. */
export async function batch(statements: InStatement[]): Promise<void> {
  if (!statements.length) return;
  await initDb();
  await getClient().batch(statements, "write");
}

/**
 * Columns added after a database already exists.
 *
 * CREATE TABLE IF NOT EXISTS does nothing to a table that is already there, so
 * new columns need adding explicitly. Each entry is applied only when missing,
 * which makes this safe to run on every boot and non-destructive to live data.
 */
const ADDED_COLUMNS: { table: string; column: string; definition: string }[] = [
  { table: "time_blocks", column: "note", definition: "TEXT NOT NULL DEFAULT ''" },
  // Marks a category whose tasks are done together in a focus room.
  { table: "categories", column: "focus_room", definition: "INTEGER NOT NULL DEFAULT 0" },
  // A task is a focus session or it isn't — independent of its category, so a
  // focus session can be for school, church, work or anything else.
  { table: "tasks", column: "focus_room", definition: "INTEGER NOT NULL DEFAULT 0" },
  { table: "focus_room_members", column: "camera_on", definition: "INTEGER NOT NULL DEFAULT 1" },
  { table: "focus_room_members", column: "recorded", definition: "INTEGER NOT NULL DEFAULT 0" },
  // The room belongs to the group, not to one person's task. Each member
  // brings their own task into it, and only they can see which one it is.
  { table: "focus_room_members", column: "task_id", definition: "INTEGER" },
];

async function addMissingColumns() {
  const client = getClient();
  for (const { table, column, definition } of ADDED_COLUMNS) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    const has = info.rows.some((r) => (r as unknown as { name: string }).name === column);
    if (has) continue;
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[cadence] Added column ${table}.${column}`);
  }
}

/**
 * A brand-new database has no groups, and sign-up requires an invite code that
 * matches one — so without this nobody could ever create the first account.
 * On first boot only, create one group whose code comes from
 * CADENCE_INVITE_CODE (or a random one, printed to the logs).
 */
async function ensureBootstrapGroup() {
  const rs = await getClient().execute("SELECT COUNT(*) AS n FROM groups");
  if (Number((rs.rows[0] as unknown as { n: number }).n) > 0) return;
  const code =
    (process.env.CADENCE_INVITE_CODE || "").trim() ||
    "JOIN-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const name = process.env.CADENCE_GROUP_NAME?.trim() || "Accountability group";
  await getClient().execute({
    sql: "INSERT INTO groups (name, invite_code) VALUES (?, ?)",
    args: [name, code],
  });
  console.log(
    `[cadence] Created the first accountability group "${name}". ` +
      `Invite code: ${code} — share it with your group so they can sign up at /join.`
  );
}

/** Test/scripts helper: forget the cached client (e.g. after changing env). */
export function _resetDb() {
  client = null;
  ready = null;
}

const SCHEMA = `
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
    archived INTEGER NOT NULL DEFAULT 0,
    -- Tasks in this category are done together in a focus room, and can only
    -- be completed by actually turning up to one.
    focus_room INTEGER NOT NULL DEFAULT 0
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
    -- 'focus'|'break'|'rest'|'travel'|'social'|'personal'|'unplanned'|'other'|'sleep'
    label     TEXT NOT NULL DEFAULT '',
    note      TEXT NOT NULL DEFAULT ''   -- private; what happened in that time
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

  -- ---------- Focus rooms ----------
  -- A room is opened for one scheduled task and is what makes that task
  -- completable: presence here is the evidence, not a tick.
  CREATE TABLE IF NOT EXISTS focus_rooms (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    opened_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT 'Focus session',
    date       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_rooms_group_date ON focus_rooms(group_id, date);

  CREATE TABLE IF NOT EXISTS focus_room_members (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id       INTEGER NOT NULL REFERENCES focus_rooms(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
    left_at       TEXT,
    last_seen     TEXT NOT NULL DEFAULT (datetime('now')),
    present       INTEGER NOT NULL DEFAULT 1,  -- 0 while the tab is hidden
    away_since    TEXT,
    away_count    INTEGER NOT NULL DEFAULT 0,
    present_secs  INTEGER NOT NULL DEFAULT 0,  -- accumulated time actually here
    tasks_done    INTEGER NOT NULL DEFAULT 0,
    tasks_total   INTEGER NOT NULL DEFAULT 0,
    share_list    INTEGER NOT NULL DEFAULT 0,  -- 0 = only the count is shared
    camera_on     INTEGER NOT NULL DEFAULT 1,
    recorded      INTEGER NOT NULL DEFAULT 0,  -- a focus_sessions row exists
    UNIQUE (room_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS focus_room_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id    INTEGER NOT NULL REFERENCES focus_rooms(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    kind       TEXT NOT NULL DEFAULT 'chat',  -- 'chat' | 'system'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_room_msgs ON focus_room_messages(room_id, id);

  -- Every time someone slips away from an active room and comes back, one row
  -- lands here: when, for how long, and (once they answer) why. This is the
  -- accountability log the analytics read from.
  CREATE TABLE IF NOT EXISTS focus_room_interruptions (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id  INTEGER NOT NULL REFERENCES focus_rooms(id) ON DELETE CASCADE,
    user_id  INTEGER NOT NULL,
    away_at  TEXT,
    back_at  TEXT,
    seconds  INTEGER NOT NULL DEFAULT 0,
    reason   TEXT NOT NULL DEFAULT '',
    note     TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_room_ints ON focus_room_interruptions(room_id, user_id);

  -- Connection setup passes through here so the video itself can go straight
  -- between devices. Rows are consumed by the recipient and short-lived.
  CREATE TABLE IF NOT EXISTS focus_room_signals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id    INTEGER NOT NULL REFERENCES focus_rooms(id) ON DELETE CASCADE,
    from_user  INTEGER NOT NULL,
    to_user    INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_room_signals ON focus_room_signals(room_id, to_user, id);

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id            INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    focus_defaults     TEXT NOT NULL DEFAULT '{}',
    notification_prefs TEXT NOT NULL DEFAULT '{}',
    dashboard_sections TEXT NOT NULL DEFAULT '["today","goals","accountability","upcoming","focus"]'
  );
  `;
