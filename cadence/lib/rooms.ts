import { all, get, run } from "./db";
import type { FocusRoomRow, FocusRoomMemberRow, RoomMessageRow } from "./types";

/**
 * Focus rooms: the group turns up and works at the same time.
 *
 * A room belongs to the group, not to anybody's task — one room is open at a
 * time so everyone who turns up lands in the same place. Each member brings
 * their own task into the room (focus_room_members.task_id) and nobody else
 * sees what it is, which is also why the room's own title never names it.
 *
 * Presence here is what makes a focus task completable — a tick on its own is
 * a claim, turning up is a record. Everything in this file is scoped to the
 * caller's own accountability group; nobody can see or join another group's
 * room.
 */

/** Rooms are never named after anyone's task — the group shares the room, not the work. */
export const ROOM_TITLE = "Focus room";

/** Treated as away once a heartbeat is this old. */
export const AWAY_AFTER_SECONDS = 35;
/** Minimum time in the room before its task may be marked complete. */
export const MIN_PRESENT_SECONDS = 60;

export type RoomMember = FocusRoomMemberRow & {
  display_name: string;
  username: string;
  accent: string;
  has_avatar: number;
  stale: boolean;      // heartbeat too old — treated as gone
  away_secs: number;   // how long they have been away right now
  interruptions: number;
};

export async function getRoom(roomId: number): Promise<FocusRoomRow | undefined> {
  return get<FocusRoomRow>("SELECT * FROM focus_rooms WHERE id=?", [roomId]);
}

/** Members with their identity, newest join first. */
export async function roomMembers(roomId: number): Promise<RoomMember[]> {
  const rows = await all<FocusRoomMemberRow & {
    display_name: string; username: string; accent: string; has_avatar: number;
    age: number; away_secs: number; interruptions: number;
  }>(
    `SELECT m.*, u.display_name, u.username, u.accent,
            (u.avatar_blob IS NOT NULL) AS has_avatar,
            CAST((julianday('now') - julianday(m.last_seen)) * 86400 AS INTEGER) AS age,
            CASE WHEN m.away_since IS NOT NULL
                 THEN CAST((julianday('now') - julianday(m.away_since)) * 86400 AS INTEGER)
                 ELSE 0 END AS away_secs,
            (SELECT COUNT(*) FROM focus_room_interruptions i
              WHERE i.room_id = m.room_id AND i.user_id = m.user_id) AS interruptions
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

/**
 * The room the group is currently in, if any.
 *
 * One open room per group: whoever arrives first opens it and everyone else
 * joins that same one. Rooms older than 12 hours are treated as abandoned
 * rather than kept open forever.
 */
export async function openRoomForGroup(groupId: number): Promise<FocusRoomRow | undefined> {
  return get<FocusRoomRow>(
    `SELECT * FROM focus_rooms
      WHERE group_id = ? AND closed_at IS NULL
        AND created_at > datetime('now', '-12 hours')
      ORDER BY id DESC LIMIT 1`,
    [groupId]
  );
}

/** The task this member brought into the room, if they picked one. */
export async function memberTask(roomId: number, userId: number) {
  const row = await get<{ task_id: number | null }>(
    "SELECT task_id FROM focus_room_members WHERE room_id=? AND user_id=?",
    [roomId, userId]
  );
  return row?.task_id ?? null;
}

/**
 * How long this user has actually been present in a room working on this
 * task. Used to decide whether the task may be marked complete.
 *
 * The second half of the union reads rooms opened before rooms became
 * group-level, where the task lived on the room rather than on the member.
 */
export async function presenceForTask(taskId: number, userId: number): Promise<number> {
  const row = await get<{ secs: number }>(
    `SELECT COALESCE(MAX(secs), 0) AS secs FROM (
       SELECT m.present_secs AS secs FROM focus_room_members m
        WHERE m.task_id = ? AND m.user_id = ?
       UNION ALL
       SELECT m.present_secs FROM focus_rooms r
         JOIN focus_room_members m ON m.room_id = r.id
        WHERE r.task_id = ? AND m.user_id = ? AND m.task_id IS NULL
     )`,
    [taskId, userId, taskId, userId]
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
       LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.date = ?
        AND (t.focus_room = 1 OR c.focus_room = 1)
      ORDER BY (t.start_min IS NULL), t.start_min`,
    [userId, date]
  );
}

/** Has this user ever marked anything as a focus session? */
export async function hasFocusCategory(userId: number): Promise<boolean> {
  const row = await get<{ n: number }>(
    `SELECT
       (SELECT COUNT(*) FROM tasks WHERE user_id=? AND focus_room=1) +
       (SELECT COUNT(*) FROM categories WHERE user_id=? AND focus_room=1 AND archived=0) AS n`,
    [userId, userId]
  );
  return (row?.n ?? 0) > 0;
}

/**
 * Presence and interruption counts for a set of this user's tasks — what the
 * planner needs to say "not started / in progress / interrupted / completed
 * through the room" against each focus task.
 */
export async function focusPresenceForTasks(
  userId: number,
  taskIds: number[]
): Promise<Map<number, { secs: number; interruptions: number }>> {
  const map = new Map<number, { secs: number; interruptions: number }>();
  if (!taskIds.length) return map;
  const marks = taskIds.map(() => "?").join(",");
  // The task is the member's own; COALESCE falls back to the room's task for
  // sittings recorded before rooms stopped belonging to a single task.
  const rows = await all<{ tid: number; secs: number; ints: number }>(
    `SELECT tid, MAX(secs) AS secs, SUM(ints) AS ints FROM (
       SELECT COALESCE(m.task_id, r.task_id) AS tid,
              m.present_secs AS secs,
              (SELECT COUNT(*) FROM focus_room_interruptions i
                WHERE i.room_id = m.room_id AND i.user_id = m.user_id) AS ints
         FROM focus_room_members m
         JOIN focus_rooms r ON r.id = m.room_id
        WHERE m.user_id = ?
     ) WHERE tid IN (${marks}) GROUP BY tid`,
    [userId, ...taskIds]
  );
  for (const r of rows) map.set(r.tid, { secs: r.secs, interruptions: r.ints });
  return map;
}

/** This user's interruption log for one room, oldest first. */
export async function interruptionsFor(roomId: number, userId: number) {
  return all<{ id: number; away_at: string; back_at: string; seconds: number; reason: string }>(
    `SELECT id, away_at, back_at, seconds, reason FROM focus_room_interruptions
      WHERE room_id = ? AND user_id = ? ORDER BY id`,
    [roomId, userId]
  );
}
