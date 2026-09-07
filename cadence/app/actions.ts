"use server";

import { all, get, run, batch } from "@/lib/db";
import {
  createSession, destroySession, getSessionUser, hashPassword,
  verifyPassword, requireUser, getGroupForUser,
} from "@/lib/auth";
import { safeTz, todayInTz, parseClock, addDays } from "@/lib/time";
import { parseTimetableText } from "@/lib/timetable-parse";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/** Every mutating action: authenticate, validate, act, revalidate. */

function str(fd: FormData, key: string, max = 500): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.slice(0, max).trim() : "";
}
function num(fd: FormData, key: string): number | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------- Auth ----------------

export async function loginAction(_prev: unknown, fd: FormData) {
  const username = str(fd, "username", 60);
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  if (!username || !password) return { error: "Enter your username and password." };
  const row = await get<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE username = ?", [username]
  );
  if (!row || !verifyPassword(password, row.password_hash))
    return { error: "That username or password isn't right." };
  await createSession(row.id);
  redirect("/dashboard");
}

export async function signupAction(_prev: unknown, fd: FormData) {
  const username = str(fd, "username", 40).toLowerCase();
  const displayName = str(fd, "display_name", 60) || username;
  const password = typeof fd.get("password") === "string" ? (fd.get("password") as string) : "";
  const invite = str(fd, "invite", 40);
  const role = str(fd, "role", 10) === "working" ? "working" : "student";
  // Whatever the browser reports, only ever store a zone Intl accepts.
  const timezone = safeTz(str(fd, "timezone", 60));

  if (!/^[a-z0-9_.-]{2,40}$/.test(username))
    return { error: "Username: 2–40 characters, letters/numbers/._- only." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const open = process.env.CADENCE_OPEN_SIGNUP === "1";
  let groupId: number | null = null;
  if (!open) {
    const g = await get<{ id: number }>(
      "SELECT id FROM groups WHERE invite_code = ?", [invite]
    );
    if (!g) return { error: "That invite code doesn't match a group." };
    groupId = g.id;
  }
  const exists = await get("SELECT 1 AS x FROM users WHERE username = ?", [username]);
  if (exists) return { error: "That username is taken." };

  const info = await run(
    `INSERT INTO users (username, display_name, password_hash, role, timezone)
     VALUES (?, ?, ?, ?, ?)`,
    [username, displayName, hashPassword(password), role, timezone]
  );
  const userId = info.lastInsertRowid;
  await run("INSERT INTO user_settings (user_id) VALUES (?)", [userId]);
  await seedDefaultCategories(userId, role);
  if (groupId)
    await run("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)", [groupId, userId]);
  await createSession(userId);
  redirect("/dashboard");
}

async function seedDefaultCategories(userId: number, role: string) {
  const defaults: [string, string][] =
    role === "working"
      ? [["Work", "#b7c4d6"], ["Spiritual", "#cbb9d9"], ["Exercise", "#a8c5b4"],
         ["Finance", "#d9c9a8"], ["Personal", "#d6bcb4"], ["Admin", "#c4c4bc"]]
      : [["Academic", "#b7c4d6"], ["Spiritual", "#cbb9d9"], ["Exercise", "#a8c5b4"],
         ["Social", "#d9b8c4"], ["Personal", "#d6bcb4"], ["Admin", "#c4c4bc"]];
  await batch(
    defaults.map(([name, color], i) => ({
      sql: "INSERT INTO categories (user_id, name, color, position) VALUES (?, ?, ?, ?)",
      args: [userId, name, color, i],
    }))
  );
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

// ---------------- Profile / settings ----------------

export async function updateProfileAction(_prev: unknown, fd: FormData) {
  const user = await requireUser();
  const displayName = str(fd, "display_name", 60);
  const bio = str(fd, "bio", 400);
  const email = str(fd, "email", 120);
  const timezone = str(fd, "timezone", 60) || user.timezone;
  const role = str(fd, "role", 10) === "working" ? "working" : "student";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { error: "That timezone isn't a valid IANA timezone." };
  }
  await run("UPDATE users SET display_name=?, bio=?, email=?, timezone=?, role=? WHERE id=?", [
    displayName || user.display_name, bio, email || null, timezone, role, user.id,
  ]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateAppearanceAction(appearance: string) {
  const user = await requireUser();
  if (!["light", "dark", "system"].includes(appearance)) return;
  await run("UPDATE users SET appearance=? WHERE id=?", [appearance, user.id]);
  revalidatePath("/", "layout");
}

export async function changePasswordAction(_prev: unknown, fd: FormData) {
  const user = await requireUser();
  const current = (fd.get("current") as string) ?? "";
  const next = (fd.get("next") as string) ?? "";
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const row = await get<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id=?", [user.id]
  );
  if (!row || !verifyPassword(current, row.password_hash))
    return { error: "Current password is incorrect." };
  await run("UPDATE users SET password_hash=? WHERE id=?", [hashPassword(next), user.id]);
  return { ok: true };
}

export async function uploadAvatarAction(
  fd: FormData
): Promise<{ error: string } | void> {
  const user = await requireUser();
  const file = fd.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "No picture was chosen." };
  // The browser resizes before sending, so anything still large is suspect.
  if (file.size > 2 * 1024 * 1024)
    return { error: "That picture is too large even after resizing. Try a different one." };
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return { error: "Pictures need to be JPEG, PNG or WebP." };
  const buf = new Uint8Array(await file.arrayBuffer());
  await run("UPDATE users SET avatar_blob=?, avatar_mime=? WHERE id=?", [buf, file.type, user.id]);
  revalidatePath("/", "layout");
}

export async function removeAvatarAction() {
  const user = await requireUser();
  await run("UPDATE users SET avatar_blob=NULL, avatar_mime=NULL WHERE id=?", [user.id]);
  revalidatePath("/", "layout");
}

export async function saveNotificationPrefsAction(fd: FormData) {
  const user = await requireUser();
  const keys = [
    "daily_planning", "uncompleted_tasks", "goal_actions", "calendar_events",
    "deadlines", "monthly_review", "focus_sessions", "streaks",
  ];
  const prefs: Record<string, boolean> = {};
  for (const k of keys) prefs[k] = fd.get(k) === "on";
  await run("UPDATE user_settings SET notification_prefs=? WHERE user_id=?", [
    JSON.stringify(prefs), user.id,
  ]);
  revalidatePath("/settings");
}

// ---------------- Categories ----------------

export async function createCategoryAction(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name", 40);
  const color = safeColor(str(fd, "color", 9));
  const kind = ["task", "goal", "both"].includes(str(fd, "kind")) ? str(fd, "kind") : "both";
  if (!name) return;
  const max = await get<{ m: number }>(
    "SELECT COALESCE(MAX(position),0) AS m FROM categories WHERE user_id=?", [user.id]
  );
  await run(
    `INSERT INTO categories (user_id, name, color, kind, position, focus_room)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, name, color, kind, Number(max?.m ?? 0) + 1, /focus/i.test(name) ? 1 : 0]
  );
  revalidatePath("/", "layout");
}

/**
 * Creates a category from wherever you happen to need one — the task form,
 * the goal wizard — and returns its id so the caller can select it straight
 * away instead of sending you to Settings and back.
 */
export async function addCategoryInlineAction(
  name: string,
  color: string
): Promise<{ id: number; name: string; color: string } | { error: string }> {
  const user = await requireUser();
  const clean = String(name ?? "").trim().slice(0, 40);
  if (!clean) return { error: "Give the category a name." };
  const safe = safeColor(String(color ?? ""));

  const existing = await get<{ id: number }>(
    "SELECT id FROM categories WHERE user_id=? AND name=? COLLATE NOCASE AND archived=0",
    [user.id, clean]
  );
  if (existing) return { error: "You already have a category with that name." };

  const max = await get<{ m: number }>(
    "SELECT COALESCE(MAX(position),0) AS m FROM categories WHERE user_id=?", [user.id]
  );
  const info = await run(
    "INSERT INTO categories (user_id, name, color, kind, position) VALUES (?, ?, ?, 'both', ?)",
    [user.id, clean, safe, Number(max?.m ?? 0) + 1]
  );
  revalidatePath("/", "layout");
  return { id: info.lastInsertRowid, name: clean, color: safe };
}

export async function updateCategoryAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const name = str(fd, "name", 40);
  const color = safeColor(str(fd, "color", 9));
  if (!id || !name) return;
  await run("UPDATE categories SET name=?, color=?, focus_room=? WHERE id=? AND user_id=?", [
    name, color, fd.get("focus_room") === "on" ? 1 : 0, id, user.id,
  ]);
  revalidatePath("/", "layout");
}

export async function deleteCategoryAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  // Archive rather than delete so historic analytics keep their labels.
  await run("UPDATE categories SET archived=1 WHERE id=? AND user_id=?", [id, user.id]);
  revalidatePath("/", "layout");
}

function safeColor(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#b8b8b0";
}

// ---------------- Tasks ----------------

export async function createTaskAction(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name", 200);
  const date = str(fd, "date", 10);
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const categoryId = num(fd, "category_id");
  const priority = ["A", "B", "C"].includes(str(fd, "priority")) ? str(fd, "priority") : "B";
  const planned = Math.min(Math.max(num(fd, "planned_minutes") ?? 30, 5), 24 * 60);
  const start = parseClock(str(fd, "start_time"));
  const end = parseClock(str(fd, "end_time"));
  const notes = str(fd, "notes", 2000);
  await run(
    `INSERT INTO tasks (user_id, date, name, category_id, priority, planned_minutes,
      start_min, end_min, notes, focus_room) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      user.id, date, name, await ownCategory(user.id, categoryId), priority, planned,
      start, end !== null && start !== null && end > start ? end : null, notes,
      fd.get("focus_room") === "on" ? 1 : 0,
    ]
  );
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

export async function updateTaskAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  const name = str(fd, "name", 200);
  const priority = ["A", "B", "C"].includes(str(fd, "priority")) ? str(fd, "priority") : "B";
  const planned = Math.min(Math.max(num(fd, "planned_minutes") ?? 30, 5), 24 * 60);
  const start = parseClock(str(fd, "start_time"));
  const end = parseClock(str(fd, "end_time"));
  const notes = str(fd, "notes", 2000);
  const categoryId = num(fd, "category_id");
  if (!name) return;
  await run(
    `UPDATE tasks SET name=?, category_id=?, priority=?, planned_minutes=?,
       start_min=?, end_min=?, notes=?, focus_room=? WHERE id=? AND user_id=?`,
    [
      name, await ownCategory(user.id, categoryId), priority, planned,
      start, end !== null && start !== null && end > start ? end : null,
      notes, fd.get("focus_room") === "on" ? 1 : 0, id, user.id,
    ]
  );
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

/**
 * Completing a task in a focus-room category requires having actually been in
 * the room for it. The whole point of the room is that turning up is the
 * evidence, so the tick cannot be given on its own.
 */
export async function toggleTaskAction(
  id: number, completed: boolean
): Promise<{ error: string } | void> {
  const user = await requireUser();

  if (completed) {
    const needsRoom = await get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM tasks t
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.id = ? AND t.user_id = ?
          AND (t.focus_room = 1 OR c.focus_room = 1)`,
      [id, user.id]
    );
    if ((needsRoom?.n ?? 0) > 0) {
      const { presenceForTask, MIN_PRESENT_SECONDS } = await import("@/lib/rooms");
      const secs = await presenceForTask(id, user.id);
      if (secs < MIN_PRESENT_SECONDS) {
        return {
          error:
            "This one is done in the focus room — go into the room with this task " +
            `selected and stay at least ${Math.round(MIN_PRESENT_SECONDS / 60)} minute(s) ` +
            "before ticking it.",
        };
      }
    }
  }

  await run("UPDATE tasks SET completed=?, completed_at=? WHERE id=? AND user_id=?", [
    completed ? 1 : 0, completed ? new Date().toISOString() : null, id, user.id,
  ]);
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

export async function deleteTaskAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  await run("DELETE FROM tasks WHERE id=? AND user_id=?", [id, user.id]);
  revalidatePath("/today");
}

/** Move an unfinished task to another day (records where it came from). */
export async function moveTaskAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const toDate = str(fd, "to_date", 10);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return;
  const t = await get<{ date: string; original_date: string | null }>(
    "SELECT date, original_date FROM tasks WHERE id=? AND user_id=?", [id, user.id]
  );
  if (!t) return;
  await run(
    "UPDATE tasks SET date=?, original_date=?, start_min=NULL, end_min=NULL WHERE id=? AND user_id=?",
    [toDate, t.original_date ?? t.date, id, user.id]
  );
  revalidatePath("/today");
}

/**
 * Moves a whole day's tasks onto another date, exactly as they are.
 *
 * This is the "I planned this on the wrong day" fix, which is a different
 * thing from deferring a task: nothing is rescheduled, so the times, order,
 * priorities, categories, notes and ticks all carry over untouched, and the
 * tasks are not marked as moved — they were never really on that day.
 */
export async function moveDayTasksAction(
  fromDate: string, toDate: string
): Promise<{ moved: number } | { error: string }> {
  const user = await requireUser();
  const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!ok(fromDate) || !ok(toDate)) return { error: "That date isn't valid." };
  if (fromDate === toDate) return { error: "That's the same day." };

  const before = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tasks WHERE user_id=? AND date=?", [user.id, fromDate]
  );
  if ((before?.n ?? 0) === 0) return { error: "There are no tasks on that day to move." };

  await run("UPDATE tasks SET date=? WHERE user_id=? AND date=?",
    [toDate, user.id, fromDate]);

  revalidatePath("/today");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  return { moved: before!.n };
}

async function ownCategory(userId: number, categoryId: number | null): Promise<number | null> {
  if (!categoryId) return null;
  const ok = await get("SELECT 1 AS x FROM categories WHERE id=? AND user_id=?", [
    categoryId, userId,
  ]);
  return ok ? categoryId : null;
}

// ---------------- Time blocks ----------------

// "focus" = real work you tracked with the stopwatch, as opposed to time you
// deliberately set aside for something else.
const BLOCK_KINDS = [
  "focus", "break", "rest", "travel", "social", "personal", "unplanned", "other", "sleep",
];

export async function createBlockAction(_prev: unknown, fd: FormData) {
  const user = await requireUser();
  const date = str(fd, "date", 10);
  const start = parseClock(str(fd, "start_time"));
  const end = parseClock(str(fd, "end_time"));
  const kind = BLOCK_KINDS.includes(str(fd, "kind")) ? str(fd, "kind") : "break";
  const label = str(fd, "label", 80);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "That date isn't valid." };
  if (start === null) return { error: "Add a start time." };
  if (end === null) return { error: "Add an end time." };
  if (end === start) return { error: "The start and end times are the same." };

  // Sleep crosses midnight, so 22:30-06:30 has an end "before" its start, and
  // which night it belongs to is genuinely ambiguous: logged in the morning it
  // is the night just gone, logged in the evening it is the night ahead. The
  // form asks, defaulting to last night.
  if (end < start) {
    const ahead = str(fd, "night", 10) === "next";
    const evening = ahead ? date : addDays(date, -1);
    const morning = ahead ? addDays(date, 1) : date;
    await batch([
      {
        sql: "INSERT INTO time_blocks (user_id, date, start_min, end_min, kind, label) VALUES (?,?,?,?,?,?)",
        args: [user.id, evening, start, 24 * 60, kind, label],
      },
      ...(end > 0
        ? [{
            sql: "INSERT INTO time_blocks (user_id, date, start_min, end_min, kind, label) VALUES (?,?,?,?,?,?)",
            args: [user.id, morning, 0, end, kind, label] as (string | number)[],
          }]
        : []),
    ]);
    revalidatePath("/today");
    revalidatePath("/dashboard");
    return {
      ok: ahead
        ? `Logged ${fmtClockLabel(start)}–24:00 tonight and 00:00–${fmtClockLabel(end)} tomorrow.`
        : `Logged ${fmtClockLabel(start)}–24:00 yesterday and 00:00–${fmtClockLabel(end)} today.`,
    };
  }

  await run(
    "INSERT INTO time_blocks (user_id, date, start_min, end_min, kind, label) VALUES (?,?,?,?,?,?)",
    [user.id, date, start, end, kind, label]
  );
  revalidatePath("/today");
  revalidatePath("/dashboard");
  return { ok: "" };
}

function fmtClockLabel(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Logs time you actually spent, from the stopwatch, into today's schedule.
 *
 * This is the "every hour must be accounted for" path: rather than planning a
 * block in advance, you run a stopwatch on whatever you are really doing and
 * the elapsed time becomes a block on today's timeline. When it was real work,
 * it also lands in focus history so the focus totals stay honest.
 */
export async function logTrackedTimeAction(input: {
  label: string;
  kind: string;
  startMin: number;
  endMin: number;
  countAsFocus: boolean;
  note?: string;
}) {
  const user = await requireUser();
  const date = todayInTz(user.timezone);
  const kind = BLOCK_KINDS.includes(input.kind) ? input.kind : "focus";
  const start = Math.max(0, Math.min(Math.round(input.startMin), 24 * 60 - 1));
  // A stopwatch left running past midnight is logged up to midnight rather
  // than wrapping into a negative-length block.
  const end = Math.max(start + 1, Math.min(Math.round(input.endMin), 24 * 60));
  const label = String(input.label ?? "").slice(0, 80);
  const note = String(input.note ?? "").slice(0, 2000);

  await run(
    "INSERT INTO time_blocks (user_id, date, start_min, end_min, kind, label, note) VALUES (?,?,?,?,?,?,?)",
    [user.id, date, start, end, kind, label, note]
  );

  if (input.countAsFocus) {
    const seconds = (end - start) * 60;
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - seconds * 1000);
    await run(
      `INSERT INTO focus_sessions (user_id, date, started_at, ended_at, planned_minutes,
         focus_seconds, status, label)
       VALUES (?,?,?,?,?,?, 'completed', ?)`,
      [user.id, date, startedAt.toISOString(), endedAt.toISOString(),
       end - start, seconds, label || "Tracked"]
    );
  }

  revalidatePath("/today");
  revalidatePath("/focus");
  revalidatePath("/dashboard");
}

export async function deleteBlockAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  await run("DELETE FROM time_blocks WHERE id=? AND user_id=?", [id, user.id]);
  revalidatePath("/today");
}

// ---------------- Focus rooms ----------------

/**
 * One-press setup: makes a category whose tasks are done in a room. Reuses a
 * category already named for focus rather than making a second one.
 */
export async function enableFocusCategoryAction(): Promise<void> {
  const user = await requireUser();
  const existing = await get<{ id: number }>(
    `SELECT id FROM categories
      WHERE user_id=? AND archived=0 AND name LIKE '%focus%' COLLATE NOCASE
      ORDER BY id LIMIT 1`,
    [user.id]
  );
  if (existing) {
    await run("UPDATE categories SET focus_room=1 WHERE id=?", [existing.id]);
  } else {
    const max = await get<{ m: number }>(
      "SELECT COALESCE(MAX(position),0) AS m FROM categories WHERE user_id=?", [user.id]
    );
    await run(
      `INSERT INTO categories (user_id, name, color, kind, position, focus_room)
       VALUES (?, 'Focus session', '#a8c5b4', 'both', ?, 1)`,
      [user.id, Number(max?.m ?? 0) + 1]
    );
  }
  revalidatePath("/", "layout");
}

/**
 * Opens the group's focus room, or returns the one already open.
 *
 * There is one room per group at a time, deliberately: when rooms were made
 * per task, three people tapping Join on three different tasks each opened a
 * separate room and sat there alone. The room is never named after whoever
 * opened it either — their task is their own business, and the group shares
 * the room, not the work.
 *
 * `taskId` is optional: it is the caller's own task for this sitting, stored
 * against their membership when they take a seat.
 */
export async function joinFocusRoomAction(
  taskId?: number | null
): Promise<number | { error: string }> {
  const user = await requireUser();
  const group = await getGroupForUser(user.id);
  if (!group) return { error: "You're not in an accountability group yet." };

  let date = todayInTz(safeTz(user.timezone));
  if (taskId) {
    const task = await get<{ id: number; date: string; user_id: number }>(
      "SELECT id, date, user_id FROM tasks WHERE id=? AND user_id=?", [taskId, user.id]
    );
    if (!task) return { error: "That task no longer exists." };
    date = task.date;
  }

  const { openRoomForGroup, ROOM_TITLE } = await import("@/lib/rooms");
  let room = await openRoomForGroup(group.group.id);
  if (!room) {
    const info = await run(
      "INSERT INTO focus_rooms (group_id, task_id, opened_by, title, date) VALUES (?,NULL,?,?,?)",
      [group.group.id, user.id, ROOM_TITLE, date]
    );
    room = await openRoomForGroup(group.group.id);
    if (!room) return { error: String(info.lastInsertRowid) };
  }

  // The button only opens (or finds) the room; the lobby's Enter button is
  // what actually seats you, so nobody is "in the room" without meaning to be.
  return room.id;
}

/**
 * Takes a seat in a room you already have the link to — opening the page,
 * refreshing it, or coming back later. Without this, only the person who
 * pressed the button counted as being there.
 *
 * `taskId` is the task this person is working on in the room. It is theirs
 * alone: it decides their own timer and what completing from inside ticks,
 * and it is never shown to the rest of the room.
 */
export async function enterFocusRoomAction(
  roomId: number, taskId?: number | null
): Promise<void> {
  const user = await requireUser();
  const { canSeeRoom, systemMessage } = await import("@/lib/rooms");
  if (!(await canSeeRoom(roomId, user.id))) return;

  let mine: number | null = null;
  if (taskId) {
    const owned = await get<{ id: number }>(
      "SELECT id FROM tasks WHERE id=? AND user_id=?", [taskId, user.id]
    );
    mine = owned?.id ?? null;
  }

  const existing = await get<{ id: number; left_at: string | null }>(
    "SELECT id, left_at FROM focus_room_members WHERE room_id=? AND user_id=?",
    [roomId, user.id]
  );
  if (!existing) {
    await run(
      "INSERT INTO focus_room_members (room_id, user_id, task_id) VALUES (?,?,?)",
      [roomId, user.id, mine]
    );
    await systemMessage(roomId, user.id, `${user.display_name} joined`);
    return;
  }
  if (existing.left_at !== null) {
    await systemMessage(roomId, user.id, `${user.display_name} came back`);
  }
  await run(
    `UPDATE focus_room_members
        SET left_at=NULL, present=1, away_since=NULL, last_seen=datetime('now'),
            task_id=COALESCE(?, task_id)
      WHERE id=?`,
    [mine, existing.id]
  );
}

/**
 * Heartbeat. `present` is false while the tab is hidden, which is recorded
 * immediately rather than inferred later — leaving is the thing the room is
 * meant to make visible.
 */
export async function roomHeartbeatAction(
  roomId: number, present: boolean, cameraOn = true
) {
  const user = await requireUser();
  const { canSeeRoom, systemMessage } = await import("@/lib/rooms");
  if (!(await canSeeRoom(roomId, user.id))) return;

  const row = await get<{ id: number; present: number; away_since: string | null }>(
    "SELECT id, present, away_since FROM focus_room_members WHERE room_id=? AND user_id=?",
    [roomId, user.id]
  );
  if (!row) return;

  const wasPresent = row.present === 1;
  if (present && !wasPresent) {
    // Coming back closes out the absence as one interruption row; the person
    // is asked for the reason and it lands on this row.
    if (row.away_since) {
      await run(
        `INSERT INTO focus_room_interruptions (room_id, user_id, away_at, back_at, seconds)
         SELECT room_id, user_id, away_since, datetime('now'),
                CAST((julianday('now') - julianday(away_since)) * 86400 AS INTEGER)
           FROM focus_room_members
          WHERE id=? AND away_since IS NOT NULL
            AND (julianday('now') - julianday(away_since)) * 86400 >= 10`,
        [row.id]
      );
    }
    await run(
      `UPDATE focus_room_members
          SET present=1, away_since=NULL, last_seen=datetime('now'), camera_on=?
        WHERE id=?`,
      [cameraOn ? 1 : 0, row.id]
    );
    await systemMessage(roomId, user.id, `${user.display_name} came back`);
  } else if (!present && wasPresent) {
    await run(
      `UPDATE focus_room_members
          SET present=0, away_since=datetime('now'), away_count=away_count+1,
              last_seen=datetime('now')
        WHERE id=?`, [row.id]
    );
    await systemMessage(roomId, user.id, `${user.display_name} left the session`);
  } else {
    // Only time spent actually here counts towards completing the task.
    await run(
      `UPDATE focus_room_members
          SET last_seen=datetime('now'), camera_on=?,
              present_secs = present_secs + CASE WHEN present=1 THEN 10 ELSE 0 END
        WHERE id=?`,
      [cameraOn ? 1 : 0, row.id]
    );
  }
}

/** Attaches the person's stated reason to their most recent interruption. */
export async function recordInterruptionReasonAction(
  roomId: number, reason: string, note: string
) {
  const user = await requireUser();
  const { canSeeRoom } = await import("@/lib/rooms");
  if (!(await canSeeRoom(roomId, user.id))) return;
  const valid = ["distracted", "urgent", "unplanned_break", "technical", "other"];
  await run(
    `UPDATE focus_room_interruptions SET reason=?, note=?
      WHERE id = (SELECT id FROM focus_room_interruptions
                   WHERE room_id=? AND user_id=? ORDER BY id DESC LIMIT 1)`,
    [valid.includes(reason) ? reason : "other", String(note ?? "").slice(0, 300),
     roomId, user.id]
  );
}

/**
 * Ends the session on purpose. This is the moment the sitting becomes a
 * record: one focus_sessions row with the planned time, the time actually
 * present, and how it ended — which is what every analytics view reads.
 */
export async function endFocusSessionAction(
  roomId: number
): Promise<{ focusedSecs: number; plannedMinutes: number; interruptions: number } | { error: string }> {
  const user = await requireUser();
  const { canSeeRoom, systemMessage, getRoom } = await import("@/lib/rooms");
  if (!(await canSeeRoom(roomId, user.id))) return { error: "Not your room." };

  const member = await get<{
    id: number; present_secs: number; joined_at: string; recorded: number; task_id: number | null;
  }>(
    `SELECT id, present_secs, joined_at, recorded, task_id
       FROM focus_room_members WHERE room_id=? AND user_id=?`,
    [roomId, user.id]
  );
  const room = await getRoom(roomId);
  if (!member || !room) return { error: "You're not in this room." };

  // The record is about this person's own task — the room is only where they
  // sat. Falling back to the room's task keeps sittings from before rooms
  // became group-level readable.
  const anchorId = member.task_id ?? room.task_id;
  const task = anchorId
    ? await get<{ name: string; start_min: number | null; end_min: number | null; planned_minutes: number }>(
        "SELECT name, start_min, end_min, planned_minutes FROM tasks WHERE id=? AND user_id=?",
        [anchorId, user.id]
      )
    : undefined;
  const planned =
    task?.start_min !== null && task?.start_min !== undefined && task?.end_min !== null
      ? (task.end_min as number) - (task.start_min as number)
      : task?.planned_minutes ?? Math.max(1, Math.round(member.present_secs / 60));
  const label = (task?.name ?? "Focus room session").slice(0, 120);

  const ints = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM focus_room_interruptions WHERE room_id=? AND user_id=?",
    [roomId, user.id]
  );

  if (!member.recorded) {
    await run(
      `INSERT INTO focus_sessions (user_id, date, started_at, ended_at, planned_minutes,
         focus_seconds, status, label)
       VALUES (?,?,?,?,?,?, ?, ?)`,
      [user.id, room.date, member.joined_at, new Date().toISOString(), planned,
       member.present_secs, (ints?.n ?? 0) > 0 ? "interrupted" : "completed",
       label]
    );
  }
  await run(
    "UPDATE focus_room_members SET left_at=datetime('now'), present=0, recorded=1 WHERE id=?",
    [member.id]
  );
  await systemMessage(roomId, user.id, `${user.display_name} finished their session`);

  const open = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM focus_room_members WHERE room_id=? AND left_at IS NULL", [roomId]
  );
  if ((open?.n ?? 0) === 0)
    await run("UPDATE focus_rooms SET closed_at=datetime('now') WHERE id=?", [roomId]);

  revalidatePath("/today");
  revalidatePath("/focus");
  revalidatePath("/dashboard");
  return {
    focusedSecs: member.present_secs,
    plannedMinutes: planned,
    interruptions: ints?.n ?? 0,
  };
}

export async function leaveFocusRoomAction(roomId: number) {
  const user = await requireUser();
  const { canSeeRoom, systemMessage, getRoom } = await import("@/lib/rooms");
  if (!(await canSeeRoom(roomId, user.id))) return;
  // Walking out is not the same as finishing: the sitting is recorded, marked
  // interrupted, so it cannot quietly disappear from the history.
  const member = await get<{
    id: number; present_secs: number; joined_at: string; recorded: number; task_id: number | null;
  }>(
    `SELECT id, present_secs, joined_at, recorded, task_id
       FROM focus_room_members WHERE room_id=? AND user_id=?`,
    [roomId, user.id]
  );
  const room = await getRoom(roomId);
  if (member && room && !member.recorded && member.present_secs >= 30) {
    const anchorId = member.task_id ?? room.task_id;
    const task = anchorId
      ? await get<{ name: string }>("SELECT name FROM tasks WHERE id=? AND user_id=?",
          [anchorId, user.id])
      : undefined;
    await run(
      `INSERT INTO focus_sessions (user_id, date, started_at, ended_at, planned_minutes,
         focus_seconds, status, interrupt_reason, label)
       VALUES (?,?,?,?,?,?, 'interrupted', 'left_room', ?)`,
      [user.id, room.date, member.joined_at, new Date().toISOString(),
       Math.max(1, Math.round(member.present_secs / 60)), member.present_secs,
       (task?.name ?? "Focus room session").slice(0, 120)]
    );
    await run("UPDATE focus_room_members SET recorded=1 WHERE id=?", [member.id]);
  }
  await run(
    `UPDATE focus_room_members SET left_at=datetime('now'), present=0
      WHERE room_id=? AND user_id=?`,
    [roomId, user.id]
  );
  await systemMessage(roomId, user.id, `${user.display_name} left without finishing`);
  revalidatePath("/focus");
}

export async function roomSayAction(roomId: number, body: string) {
  const user = await requireUser();
  const { canSeeRoom } = await import("@/lib/rooms");
  if (!(await canSeeRoom(roomId, user.id))) return;
  const text = String(body ?? "").trim().slice(0, 500);
  if (!text) return;
  await run(
    "INSERT INTO focus_room_messages (room_id, user_id, body) VALUES (?,?,?)",
    [roomId, user.id, text]
  );
}

/**
 * Shares how far through the session's list you are. The count is shared by
 * default; the items themselves only if you opt in.
 */
export async function roomProgressAction(
  roomId: number, done: number, total: number, shareList: boolean
) {
  const user = await requireUser();
  const { canSeeRoom } = await import("@/lib/rooms");
  if (!(await canSeeRoom(roomId, user.id))) return;
  await run(
    `UPDATE focus_room_members SET tasks_done=?, tasks_total=?, share_list=?
      WHERE room_id=? AND user_id=?`,
    [Math.max(0, done), Math.max(0, total), shareList ? 1 : 0, roomId, user.id]
  );
}

// ---------------- Goals ----------------

export async function createGoalAction(_prev: unknown, fd: FormData) {
  const user = await requireUser();
  const title = str(fd, "title", 120);
  if (!title) return { error: "Give the goal a name." };
  const trackingType = [
    "number", "percent", "boolean", "time", "frequency", "streak", "quantity", "custom",
  ].includes(str(fd, "tracking_type")) ? str(fd, "tracking_type") : "number";
  const frequency = ["daily", "weekly", "monthly"].includes(str(fd, "frequency"))
    ? str(fd, "frequency") : "daily";
  let periodTarget = num(fd, "period_target") ?? 1;
  if (trackingType === "boolean") periodTarget = 1;
  if (periodTarget <= 0) return { error: "The target must be a positive number." };
  const minimum = Math.max(0, Math.min(num(fd, "minimum_target") ?? 0, periodTarget));
  const overall = num(fd, "overall_target");
  const deadline = str(fd, "deadline", 10) || null;
  const startDate = str(fd, "start_date", 10) || todayInTz(user.timezone);
  const days = (fd.getAll("active_days") as string[])
    .map(Number).filter((n) => n >= 0 && n <= 6);
  const activeDays = days.length ? days.join(",") : "0,1,2,3,4,5,6";
  const info = await run(
    `INSERT INTO goals (user_id, category_id, title, why, measurement, tracking_type,
       unit, frequency, period_target, minimum_target, overall_target, daily_action,
       evidence, start_date, deadline, active_days, share_progress)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      user.id, await ownCategory(user.id, num(fd, "category_id")), title,
      str(fd, "why", 1000), str(fd, "measurement", 500), trackingType,
      str(fd, "unit", 30), frequency, periodTarget, minimum, overall,
      str(fd, "daily_action", 500), str(fd, "evidence", 500),
      startDate, deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
      activeDays, fd.get("share_progress") === "off" ? 0 : 1,
    ]
  );
  redirect(`/goals/${info.lastInsertRowid}`);
}

export async function updateGoalAction(_prev: unknown, fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return { error: "Missing goal." };
  const own = await get("SELECT id FROM goals WHERE id=? AND user_id=?", [id, user.id]);
  if (!own) return { error: "Not your goal." };
  const title = str(fd, "title", 120);
  if (!title) return { error: "Give the goal a name." };
  let periodTarget = num(fd, "period_target") ?? 1;
  const trackingType = str(fd, "tracking_type");
  if (trackingType === "boolean") periodTarget = 1;
  if (periodTarget <= 0) return { error: "The target must be a positive number." };
  const days = (fd.getAll("active_days") as string[])
    .map(Number).filter((n) => n >= 0 && n <= 6);
  await run(
    `UPDATE goals SET title=?, category_id=?, why=?, measurement=?, unit=?,
       period_target=?, minimum_target=?, overall_target=?, daily_action=?, evidence=?,
       deadline=?, active_days=?, share_progress=? WHERE id=? AND user_id=?`,
    [
      title, await ownCategory(user.id, num(fd, "category_id")),
      str(fd, "why", 1000), str(fd, "measurement", 500), str(fd, "unit", 30),
      periodTarget, Math.max(0, Math.min(num(fd, "minimum_target") ?? 0, periodTarget)),
      num(fd, "overall_target"),
      str(fd, "daily_action", 500), str(fd, "evidence", 500),
      /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "deadline", 10)) ? str(fd, "deadline", 10) : null,
      days.length ? days.join(",") : "0,1,2,3,4,5,6",
      fd.get("share_progress") === "on" ? 1 : 0,
      id, user.id,
    ]
  );
  revalidatePath(`/goals/${id}`);
  revalidatePath("/goals");
  return { ok: true };
}

export async function goalStatusAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const action = str(fd, "action", 20);
  if (!id) return;
  const goal = await get<{ pauses_json: string; status: string }>(
    "SELECT * FROM goals WHERE id=? AND user_id=?", [id, user.id]
  );
  if (!goal) return;
  const today = todayInTz(user.timezone);
  const pauses = JSON.parse(goal.pauses_json || "[]") as { from: string; to?: string }[];
  if (action === "pause" && goal.status === "active") {
    pauses.push({ from: today });
    await run("UPDATE goals SET status='paused', paused_at=?, pauses_json=? WHERE id=?", [
      today, JSON.stringify(pauses), id,
    ]);
  } else if (action === "resume" && goal.status === "paused") {
    const open = pauses[pauses.length - 1];
    if (open && !open.to) open.to = today;
    await run("UPDATE goals SET status='active', paused_at=NULL, pauses_json=? WHERE id=?", [
      JSON.stringify(pauses), id,
    ]);
  } else if (action === "complete") {
    await run("UPDATE goals SET status='completed', completed_at=? WHERE id=?", [
      new Date().toISOString(), id,
    ]);
  } else if (action === "reactivate" && goal.status === "completed") {
    await run("UPDATE goals SET status='active', completed_at=NULL WHERE id=?", [id]);
  } else if (action === "archive") {
    await run("UPDATE goals SET status='archived' WHERE id=?", [id]);
  }
  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
}

/** Log progress for a goal on a date (upsert). */
export async function checkinAction(goalId: number, date: string, value: number, note?: string) {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value)) return;
  const goal = await get("SELECT id FROM goals WHERE id=? AND user_id=?", [goalId, user.id]);
  if (!goal) return;
  const today = todayInTz(user.timezone);
  if (date > today) return; // no logging the future
  await run(
    `INSERT INTO goal_checkins (goal_id, user_id, date, value, note)
     VALUES (?,?,?,?,?)
     ON CONFLICT (goal_id, date) DO UPDATE SET value=excluded.value,
       note=CASE WHEN excluded.note != '' THEN excluded.note ELSE goal_checkins.note END`,
    [goalId, user.id, date, Math.max(0, value), (note ?? "").slice(0, 500)]
  );
  revalidatePath("/goals");
  revalidatePath(`/goals/${goalId}`);
  revalidatePath("/dashboard");
}

// ---------------- Calendar events ----------------

const EVENT_CATS = ["test", "exam", "assignment", "deadline", "meeting", "church",
  "birthday", "important", "personal", "custom"];

export async function createEventAction(fd: FormData) {
  const user = await requireUser();
  const title = str(fd, "title", 140);
  const date = str(fd, "date", 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await run(
    `INSERT INTO calendar_events (user_id, title, date, start_min, end_min, category,
       color, notes, reminder_minutes) VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      user.id, title, date,
      parseClock(str(fd, "start_time")), parseClock(str(fd, "end_time")),
      EVENT_CATS.includes(str(fd, "category")) ? str(fd, "category") : "personal",
      safeColor(str(fd, "color", 9)), str(fd, "notes", 2000),
      num(fd, "reminder_minutes"),
    ]
  );
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function updateEventAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const title = str(fd, "title", 140);
  const date = str(fd, "date", 10);
  if (!id || !title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await run(
    `UPDATE calendar_events SET title=?, date=?, start_min=?, end_min=?, category=?,
       color=?, notes=?, reminder_minutes=? WHERE id=? AND user_id=?`,
    [
      title, date, parseClock(str(fd, "start_time")), parseClock(str(fd, "end_time")),
      EVENT_CATS.includes(str(fd, "category")) ? str(fd, "category") : "personal",
      safeColor(str(fd, "color", 9)), str(fd, "notes", 2000),
      num(fd, "reminder_minutes"), id, user.id,
    ]
  );
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function deleteEventAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  await run("DELETE FROM calendar_events WHERE id=? AND user_id=?", [id, user.id]);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

/** Pin/unpin an event into one of the 3 dashboard countdown slots. */
export async function setCountdownAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const slotRaw = num(fd, "slot");
  if (!id) return;
  if (slotRaw === null || slotRaw === 0) {
    await run("UPDATE calendar_events SET countdown_slot=NULL WHERE id=? AND user_id=?", [
      id, user.id,
    ]);
  } else {
    const slot = Math.min(Math.max(Math.round(slotRaw), 1), 3);
    await batch([
      {
        sql: "UPDATE calendar_events SET countdown_slot=NULL WHERE user_id=? AND countdown_slot=?",
        args: [user.id, slot],
      },
      {
        sql: "UPDATE calendar_events SET countdown_slot=? WHERE id=? AND user_id=?",
        args: [slot, id, user.id],
      },
    ]);
  }
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

// ---------------- Timetable ----------------

export async function createTimetableEntryAction(fd: FormData) {
  const user = await requireUser();
  const day = num(fd, "day_of_week");
  const start = parseClock(str(fd, "start_time"));
  const end = parseClock(str(fd, "end_time"));
  const title = str(fd, "title", 120);
  if (day === null || day < 0 || day > 6 || start === null || end === null || end <= start || !title)
    return;
  await run(
    `INSERT INTO timetable_entries (user_id, day_of_week, start_min, end_min, title, location, color)
     VALUES (?,?,?,?,?,?,?)`,
    [user.id, day, start, end, title, str(fd, "location", 80), safeColor(str(fd, "color", 9))]
  );
  revalidatePath("/timetable");
}

export async function deleteTimetableEntryAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  await run("DELETE FROM timetable_entries WHERE id=? AND user_id=?", [id, user.id]);
  revalidatePath("/timetable");
}

export async function parseTimetableAction(_prev: unknown, fd: FormData) {
  await requireUser();
  const text = str(fd, "text", 20000);
  const entries = parseTimetableText(text);
  if (!entries.length)
    return { error: "Couldn't find any lines like “Monday 08:00–10:00 Lecture”. Check the format.", entries: [] };
  return { entries };
}

export async function saveParsedTimetableAction(entries: {
  day_of_week: number; start_min: number; end_min: number; title: string; location: string;
}[]) {
  const user = await requireUser();
  await batch(
    entries
      .slice(0, 200)
      .filter((e) => e.day_of_week >= 0 && e.day_of_week <= 6 && e.end_min > e.start_min)
      .map((e) => ({
        sql: `INSERT INTO timetable_entries (user_id, day_of_week, start_min, end_min, title, location, source)
              VALUES (?,?,?,?,?,?, 'import')`,
        args: [
          user.id, Math.round(e.day_of_week), Math.round(e.start_min),
          Math.round(e.end_min), String(e.title).slice(0, 120), String(e.location).slice(0, 80),
        ],
      }))
  );
  revalidatePath("/timetable");
}

export async function uploadTimetableFileAction(fd: FormData) {
  const user = await requireUser();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 3.5 * 1024 * 1024) return; // stays under the serverless body limit
  if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) return;
  const buf = new Uint8Array(await file.arrayBuffer());
  await run("INSERT INTO timetable_uploads (user_id, filename, mime, data) VALUES (?,?,?,?)", [
    user.id, file.name.slice(0, 120), file.type, buf,
  ]);
  revalidatePath("/timetable");
}

export async function deleteTimetableUploadAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  await run("DELETE FROM timetable_uploads WHERE id=? AND user_id=?", [id, user.id]);
  revalidatePath("/timetable");
}

/** Copy today's timetable entries into the daily planner as scheduled tasks. */
export async function importTimetableToDayAction(fd: FormData) {
  const user = await requireUser();
  const date = str(fd, "date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const dow = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
  const [entries, existing] = await Promise.all([
    all<{ start_min: number; end_min: number; title: string }>(
      "SELECT * FROM timetable_entries WHERE user_id=? AND day_of_week=? ORDER BY start_min",
      [user.id, dow]
    ),
    all<{ name: string; start_min: number | null }>(
      "SELECT name, start_min FROM tasks WHERE user_id=? AND date=?", [user.id, date]
    ),
  ]);
  await batch(
    entries
      .filter((e) => !existing.some((x) => x.name === e.title && x.start_min === e.start_min))
      .map((e) => ({
        sql: `INSERT INTO tasks (user_id, date, name, priority, planned_minutes, start_min, end_min)
              VALUES (?,?,?, 'B', ?, ?, ?)`,
        args: [user.id, date, e.title, e.end_min - e.start_min, e.start_min, e.end_min],
      }))
  );
  revalidatePath("/today");
}

// ---------------- Focus sessions ----------------

export async function startFocusAction(config: {
  focusMinutes: number; breakMinutes: number; sessions: number;
  longBreakMinutes: number; breaksEnabled: boolean; autoStart: boolean;
  sound: boolean; label: string;
}) {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const now = new Date().toISOString();
  // Any session still 'active' from a previous visit was abandoned mid-flight:
  // keep the history, mark it interrupted (integrity rule — no silent background running).
  await run(
    `UPDATE focus_sessions SET status='interrupted', interrupt_reason='other',
       interrupt_note='Session left running and never resumed', ended_at=?
     WHERE user_id=? AND status='active'`,
    [now, user.id]
  );
  const planned = Math.min(Math.max(Math.round(config.focusMinutes), 1), 12 * 60);
  await run("UPDATE user_settings SET focus_defaults=? WHERE user_id=?", [
    JSON.stringify(config), user.id,
  ]);
  const info = await run(
    `INSERT INTO focus_sessions (user_id, date, started_at, planned_minutes, config_json, label, last_heartbeat)
     VALUES (?,?,?,?,?,?,?)`,
    [
      user.id, today, now, planned,
      JSON.stringify(config), String(config.label ?? "").slice(0, 120), now,
    ]
  );
  return info.lastInsertRowid;
}

export async function focusHeartbeatAction(id: number, focusSeconds: number) {
  const user = await requireUser();
  await run(
    `UPDATE focus_sessions SET focus_seconds=?, last_heartbeat=?
      WHERE id=? AND user_id=? AND status='active'`,
    [clampSeconds(focusSeconds), new Date().toISOString(), id, user.id]
  );
}

export async function completeFocusAction(id: number, focusSeconds: number) {
  const user = await requireUser();
  await run(
    `UPDATE focus_sessions SET status='completed', focus_seconds=?, ended_at=?
      WHERE id=? AND user_id=? AND status='active'`,
    [clampSeconds(focusSeconds), new Date().toISOString(), id, user.id]
  );
  revalidatePath("/focus");
  revalidatePath("/dashboard");
}

export async function interruptFocusAction(
  id: number, focusSeconds: number, reason: string, note: string
) {
  const user = await requireUser();
  const valid = ["distracted", "urgent", "unplanned_break", "technical", "other"];
  await run(
    `UPDATE focus_sessions SET status='interrupted', focus_seconds=?, ended_at=?,
       interrupt_reason=?, interrupt_note=?
      WHERE id=? AND user_id=? AND status IN ('active','interrupted')`,
    [
      clampSeconds(focusSeconds), new Date().toISOString(),
      valid.includes(reason) ? reason : "other", String(note ?? "").slice(0, 300),
      id, user.id,
    ]
  );
  revalidatePath("/focus");
}

/** Called on focus page load: sweep stale 'active' sessions (tab closed). */
export async function sweepStaleFocusAction() {
  const user = await requireUser();
  const rows = await all<{ id: number; last_heartbeat: string | null }>(
    "SELECT id, last_heartbeat FROM focus_sessions WHERE user_id=? AND status='active'",
    [user.id]
  );
  const cutoff = Date.now() - 45_000; // 45s without a heartbeat = interrupted
  const stale = rows.filter(
    (r) => !r.last_heartbeat || Date.parse(r.last_heartbeat) < cutoff
  );
  const now = new Date().toISOString();
  await batch(
    stale.map((r) => ({
      sql: `UPDATE focus_sessions SET status='interrupted', ended_at=?
             WHERE id=? AND status='active'`,
      args: [now, r.id],
    }))
  );
  return stale.map((r) => r.id);
}

function clampSeconds(s: number): number {
  return Math.min(Math.max(Math.round(s || 0), 0), 14 * 3600);
}

// ---------------- Monthly review ----------------

export async function saveReviewAction(month: string, answers: Record<string, unknown>, submit: boolean) {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const json = JSON.stringify(answers).slice(0, 100_000);
  await run(
    `INSERT INTO monthly_reviews (user_id, month, answers_json, submitted_at)
     VALUES (?,?,?,?)
     ON CONFLICT (user_id, month) DO UPDATE SET
       answers_json=excluded.answers_json,
       submitted_at=COALESCE(monthly_reviews.submitted_at, excluded.submitted_at)`,
    [user.id, month, json, submit ? new Date().toISOString() : null]
  );
  revalidatePath("/review");
}

// ---------------- Demo data ----------------

export async function resetDemoDataAction() {
  const user = await requireUser();
  const me = await get<{ is_demo: number }>(
    "SELECT is_demo FROM users WHERE id=?", [user.id]
  );
  if (!me?.is_demo) return; // only demo accounts can wipe demo data
  const { wipeDemoData } = await import("@/lib/seed-core");
  await wipeDemoData();
  revalidatePath("/", "layout");
}

export async function reseedDemoDataAction() {
  const user = await requireUser();
  const me = await get<{ is_demo: number }>(
    "SELECT is_demo FROM users WHERE id=?", [user.id]
  );
  if (!me?.is_demo) return;
  const { wipeDemoData, seedDemoData } = await import("@/lib/seed-core");
  await wipeDemoData();
  await seedDemoData();
  revalidatePath("/", "layout");
}
