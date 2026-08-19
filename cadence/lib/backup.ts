import { all } from "./db";

/**
 * Whole-database snapshot as JSON.
 *
 * Turso keeps the live data and offers point-in-time restore, but a copy you
 * hold yourself is the only backup nobody else can take away. This dumps every
 * table (minus password hashes and binary uploads) into one portable file.
 */

const TABLES = [
  "groups", "group_members", "categories", "tasks", "time_blocks",
  "goals", "goal_checkins", "calendar_events", "timetable_entries",
  "focus_sessions", "monthly_reviews", "user_settings",
] as const;

export type Snapshot = {
  exported_at: string;
  format_version: number;
  tables: Record<string, unknown[]>;
};

export async function snapshot(): Promise<Snapshot> {
  const tables: Record<string, unknown[]> = {};
  // Users are handled separately so password hashes never land in a backup file.
  tables.users = await all(
    `SELECT id, username, display_name, email, role, bio, timezone, appearance,
            accent, is_demo, created_at FROM users ORDER BY id`
  );
  for (const t of TABLES) tables[t] = await all(`SELECT * FROM ${t}`);
  return {
    exported_at: new Date().toISOString(),
    format_version: 1,
    tables,
  };
}

export function countRows(s: Snapshot): number {
  return Object.values(s.tables).reduce((n, rows) => n + rows.length, 0);
}
