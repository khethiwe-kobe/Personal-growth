import { all, get, run } from "./db";
import type { FocusRoomRow, FocusRoomMemberRow, RoomMessageRow } from "./types";

/**
 * Focus rooms: the group turns up together for one scheduled task.
 *
 * Presence here is what makes such a task completable — a tick on its own is
 * a claim, turning up is a record. Everything in this file is scoped to the
 * caller's own accountability group; nobody can see or join another group's
 * room.
 */

/** Treated as away once a heartbeat is this old. */
export const AWAY_AFTER_SECONDS = 35;
/** Minimum time in the room before its task may be marked complete. */
export const MIN_PRESENT_SECONDS = 60;

export type RoomMember = FocusRoomMemberRow & {
  display_name: string;
  username: string;
  accent: string;
  has_avatar: number;
  stale: boolean;   // heartbeat too old — treated as gone
};

export async function getRoom(roomId: number): Promise<FocusRoomRow | undefined> {
  return get<FocusRoomRow>("SELECT * FROM focus_rooms WHERE id=?", [roomId]);
}

/** Members with their identity, newest join first. */
export async function roomMembers(roomId: number): Promise<RoomMember[]> {
  const rows = await all<FocusRoomMemberRow & {
    display_name: string; username: string; accent: string; has_avatar: number; age: number;
  }>(
    `SELECT m.*, u.display_name, u.username, u.accent,
            (u.avatar_blob IS NOT NULL) AS has_avatar,
            CAST((julianday('now') - julianday(m.last_seen)) * 86400 AS INTEGER) AS age
       FROM focus_room_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.room_id = ?
      ORDER BY m.joined_at`,
    [roomId]
  );
  return rows.map((r) => ({ ...r, stale: r.left_at === null && r.age > AWAY_AFTER_SECONDS }));
}

export async function roomMessages(roomId: number, sinceId = 0): Promise<
  (RoomMessageRow & { display_name: string })[]
> {
  return all(
    `SELECT msg.*, u.display_name FROM focus_room_messages msg
       JOIN users u ON u.id = msg.user_id
      WHERE msg.room_id = ? AND msg.id > ?
      ORDER BY msg.id LIMIT 200`,
    [roomId, sinceId]
  );
}

/** Is this user a member of the group that owns the room? */
export async function canSeeRoom(roomId: number, userId: number): Promise<boolean> {
  const row = await get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM focus_rooms r
       JOIN group_members gm ON gm.group_id = r.group_id
      WHERE r.id = ? AND gm.user_id = ? AND gm.left_at IS NULL`,
    [roomId, userId]
  );
  return (row?.n ?? 0) > 0;
}

/** The open room for a task, if someone has already started one. */
export async function roomForTask(taskId: number): Promise<FocusRoomRow | undefined> {
  return get<FocusRoomRow>(
    "SELECT * FROM focus_rooms WHERE task_id=? AND closed_at IS NULL ORDER BY id DESC LIMIT 1",
    [taskId]
  );
}

/**
 * How long this user has actually been present in the task's room. Used to
 * decide whether the task may be marked complete.
 */
export async function presenceForTask(taskId: number, userId: number): Promise<number> {
  const row = await get<{ secs: number }>(
    `SELECT COALESCE(MAX(m.present_secs), 0) AS secs
       FROM focus_rooms r JOIN focus_room_members m ON m.room_id = r.id
      WHERE r.task_id = ? AND m.user_id = ?`,
    [taskId, userId]
  );
  return row?.secs ?? 0;
}

export async function systemMessage(roomId: number, userId: number, body: string) {
  await run(
    "INSERT INTO focus_room_messages (room_id, user_id, body, kind) VALUES (?,?,?, 'system')",
    [roomId, userId, body.slice(0, 200)]
  );
}

/** Rooms currently open in this user's group, with who is in them. */
export async function openRoomsFor(userId: number): Promise<
  { id: number; title: string; date: string; here: string[] }[]
> {
  const rooms = await all<{ id: number; title: string; date: string }>(
    `SELECT r.id, r.title, r.date FROM focus_rooms r
       JOIN group_members gm ON gm.group_id = r.group_id
      WHERE gm.user_id = ? AND gm.left_at IS NULL AND r.closed_at IS NULL
        AND r.created_at > datetime('now', '-12 hours')
      ORDER BY r.id DESC LIMIT 5`,
    [userId]
  );
  const out = [];
  for (const r of rooms) {
    const people = await all<{ display_name: string }>(
      `SELECT u.display_name FROM focus_room_members m
         JOIN users u ON u.id = m.user_id
        WHERE m.room_id = ? AND m.left_at IS NULL
          AND (julianday('now') - julianday(m.last_seen)) * 86400 < ?`,
      [r.id, AWAY_AFTER_SECONDS * 3]
    );
    out.push({ ...r, here: people.map((p) => p.display_name) });
  }
  return out;
}

/** Today's tasks of this user that are done in a room. */
export async function focusRoomTasksToday(userId: number, date: string) {
  return all<{ id: number; name: string; start_min: number | null; completed: number }>(
    `SELECT t.id, t.name, t.start_min, t.completed FROM tasks t
       JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.date = ? AND c.focus_room = 1
      ORDER BY (t.start_min IS NULL), t.start_min`,
    [userId, date]
  );
}

/** Does this user have any category set up for rooms at all? */
export async function hasFocusCategory(userId: number): Promise<boolean> {
  const row = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM categories WHERE user_id=? AND focus_room=1 AND archived=0",
    [userId]
  );
  return (row?.n ?? 0) > 0;
}
