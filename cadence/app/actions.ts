"use server";

import { getDb } from "@/lib/db";
import {
  createSession, destroySession, getSessionUser, hashPassword,
  verifyPassword, requireUser, getGroupForUser,
} from "@/lib/auth";
import { todayInTz, parseClock } from "@/lib/time";
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
  const row = getDb()
    .prepare("SELECT id, password_hash FROM users WHERE username = ?")
    .get(username) as { id: number; password_hash: string } | undefined;
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
  const timezone = str(fd, "timezone", 60) || "Africa/Johannesburg";

  if (!/^[a-z0-9_.-]{2,40}$/.test(username))
    return { error: "Username: 2–40 characters, letters/numbers/._- only." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const db = getDb();
  const open = process.env.CADENCE_OPEN_SIGNUP === "1";
  let groupId: number | null = null;
  if (!open) {
    const g = db.prepare("SELECT id FROM groups WHERE invite_code = ?").get(invite) as
      | { id: number } | undefined;
    if (!g) return { error: "That invite code doesn't match a group." };
    groupId = g.id;
  }
  const exists = db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
  if (exists) return { error: "That username is taken." };

  const info = db
    .prepare(
      `INSERT INTO users (username, display_name, password_hash, role, timezone)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(username, displayName, hashPassword(password), role, timezone);
  const userId = Number(info.lastInsertRowid);
  db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").run(userId);
  seedDefaultCategories(userId, role);
  if (groupId)
    db.prepare("INSERT INTO group_members (group_id, user_id) VALUES (?, ?)").run(groupId, userId);
  await createSession(userId);
  redirect("/dashboard");
}

function seedDefaultCategories(userId: number, role: string) {
  const db = getDb();
  const defaults: [string, string][] =
    role === "working"
      ? [["Work", "#b7c4d6"], ["Spiritual", "#cbb9d9"], ["Exercise", "#a8c5b4"],
         ["Finance", "#d9c9a8"], ["Personal", "#d6bcb4"], ["Admin", "#c4c4bc"]]
      : [["Academic", "#b7c4d6"], ["Spiritual", "#cbb9d9"], ["Exercise", "#a8c5b4"],
         ["Social", "#d9b8c4"], ["Personal", "#d6bcb4"], ["Admin", "#c4c4bc"]];
  const ins = db.prepare(
    "INSERT INTO categories (user_id, name, color, position) VALUES (?, ?, ?, ?)"
  );
  defaults.forEach(([name, color], i) => ins.run(userId, name, color, i));
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
  getDb()
    .prepare(
      "UPDATE users SET display_name=?, bio=?, email=?, timezone=?, role=? WHERE id=?"
    )
    .run(displayName || user.display_name, bio, email || null, timezone, role, user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateAppearanceAction(appearance: string) {
  const user = await requireUser();
  if (!["light", "dark", "system"].includes(appearance)) return;
  getDb().prepare("UPDATE users SET appearance=? WHERE id=?").run(appearance, user.id);
  revalidatePath("/", "layout");
}

export async function changePasswordAction(_prev: unknown, fd: FormData) {
  const user = await requireUser();
  const current = (fd.get("current") as string) ?? "";
  const next = (fd.get("next") as string) ?? "";
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  const row = getDb().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id) as
    { password_hash: string };
  if (!verifyPassword(current, row.password_hash))
    return { error: "Current password is incorrect." };
  getDb().prepare("UPDATE users SET password_hash=? WHERE id=?")
    .run(hashPassword(next), user.id);
  return { ok: true };
}

export async function uploadAvatarAction(fd: FormData) {
  const user = await requireUser();
  const file = fd.get("avatar");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 2 * 1024 * 1024) return; // 2MB cap
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return;
  const buf = Buffer.from(await file.arrayBuffer());
  getDb().prepare("UPDATE users SET avatar_blob=?, avatar_mime=? WHERE id=?")
    .run(buf, file.type, user.id);
  revalidatePath("/", "layout");
}

export async function removeAvatarAction() {
  const user = await requireUser();
  getDb().prepare("UPDATE users SET avatar_blob=NULL, avatar_mime=NULL WHERE id=?").run(user.id);
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
  getDb().prepare("UPDATE user_settings SET notification_prefs=? WHERE user_id=?")
    .run(JSON.stringify(prefs), user.id);
  revalidatePath("/settings");
}

// ---------------- Categories ----------------

export async function createCategoryAction(fd: FormData) {
  const user = await requireUser();
  const name = str(fd, "name", 40);
  const color = safeColor(str(fd, "color", 9));
  const kind = ["task", "goal", "both"].includes(str(fd, "kind")) ? str(fd, "kind") : "both";
  if (!name) return;
  const max = getDb().prepare(
    "SELECT COALESCE(MAX(position),0) AS m FROM categories WHERE user_id=?"
  ).get(user.id) as { m: number };
  getDb().prepare(
    "INSERT INTO categories (user_id, name, color, kind, position) VALUES (?, ?, ?, ?, ?)"
  ).run(user.id, name, color, kind, max.m + 1);
  revalidatePath("/", "layout");
}

export async function updateCategoryAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const name = str(fd, "name", 40);
  const color = safeColor(str(fd, "color", 9));
  if (!id || !name) return;
  getDb().prepare("UPDATE categories SET name=?, color=? WHERE id=? AND user_id=?")
    .run(name, color, id, user.id);
  revalidatePath("/", "layout");
}

export async function deleteCategoryAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  // Archive rather than delete so historic analytics keep their labels.
  getDb().prepare("UPDATE categories SET archived=1 WHERE id=? AND user_id=?").run(id, user.id);
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
  getDb().prepare(
    `INSERT INTO tasks (user_id, date, name, category_id, priority, planned_minutes,
      start_min, end_min, notes) VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    user.id, date, name, ownCategory(user.id, categoryId), priority, planned,
    start, end !== null && start !== null && end > start ? end : null, notes
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
  getDb().prepare(
    `UPDATE tasks SET name=?, category_id=?, priority=?, planned_minutes=?,
       start_min=?, end_min=?, notes=? WHERE id=? AND user_id=?`
  ).run(
    name, ownCategory(user.id, categoryId), priority, planned,
    start, end !== null && start !== null && end > start ? end : null,
    notes, id, user.id
  );
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

export async function toggleTaskAction(id: number, completed: boolean) {
  const user = await requireUser();
  getDb().prepare(
    "UPDATE tasks SET completed=?, completed_at=? WHERE id=? AND user_id=?"
  ).run(completed ? 1 : 0, completed ? new Date().toISOString() : null, id, user.id);
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

export async function deleteTaskAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM tasks WHERE id=? AND user_id=?").run(id, user.id);
  revalidatePath("/today");
}

/** Move an unfinished task to another day (records where it came from). */
export async function moveTaskAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const toDate = str(fd, "to_date", 10);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) return;
  const t = getDb().prepare("SELECT date, original_date FROM tasks WHERE id=? AND user_id=?")
    .get(id, user.id) as { date: string; original_date: string | null } | undefined;
  if (!t) return;
  getDb().prepare(
    "UPDATE tasks SET date=?, original_date=?, start_min=NULL, end_min=NULL WHERE id=? AND user_id=?"
  ).run(toDate, t.original_date ?? t.date, id, user.id);
  revalidatePath("/today");
}

function ownCategory(userId: number, categoryId: number | null): number | null {
  if (!categoryId) return null;
  const ok = getDb().prepare("SELECT 1 FROM categories WHERE id=? AND user_id=?")
    .get(categoryId, userId);
  return ok ? categoryId : null;
}

// ---------------- Time blocks ----------------

const BLOCK_KINDS = ["break", "rest", "travel", "social", "personal", "unplanned", "other", "sleep"];

export async function createBlockAction(fd: FormData) {
  const user = await requireUser();
  const date = str(fd, "date", 10);
  const start = parseClock(str(fd, "start_time"));
  const end = parseClock(str(fd, "end_time"));
  const kind = BLOCK_KINDS.includes(str(fd, "kind")) ? str(fd, "kind") : "break";
  const label = str(fd, "label", 80);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || start === null || end === null || end <= start) return;
  getDb().prepare(
    "INSERT INTO time_blocks (user_id, date, start_min, end_min, kind, label) VALUES (?,?,?,?,?,?)"
  ).run(user.id, date, start, end, kind, label);
  revalidatePath("/today");
}

export async function deleteBlockAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM time_blocks WHERE id=? AND user_id=?").run(id, user.id);
  revalidatePath("/today");
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
  const info = getDb().prepare(
    `INSERT INTO goals (user_id, category_id, title, why, measurement, tracking_type,
       unit, frequency, period_target, minimum_target, overall_target, daily_action,
       evidence, start_date, deadline, active_days, share_progress)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    user.id, ownCategory(user.id, num(fd, "category_id")), title,
    str(fd, "why", 1000), str(fd, "measurement", 500), trackingType,
    str(fd, "unit", 30), frequency, periodTarget, minimum, overall,
    str(fd, "daily_action", 500), str(fd, "evidence", 500),
    startDate, deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
    activeDays, fd.get("share_progress") === "off" ? 0 : 1
  );
  redirect(`/goals/${info.lastInsertRowid}`);
}

export async function updateGoalAction(_prev: unknown, fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return { error: "Missing goal." };
  const own = getDb().prepare("SELECT id FROM goals WHERE id=? AND user_id=?").get(id, user.id);
  if (!own) return { error: "Not your goal." };
  const title = str(fd, "title", 120);
  if (!title) return { error: "Give the goal a name." };
  let periodTarget = num(fd, "period_target") ?? 1;
  const trackingType = str(fd, "tracking_type");
  if (trackingType === "boolean") periodTarget = 1;
  if (periodTarget <= 0) return { error: "The target must be a positive number." };
  const days = (fd.getAll("active_days") as string[])
    .map(Number).filter((n) => n >= 0 && n <= 6);
  getDb().prepare(
    `UPDATE goals SET title=?, category_id=?, why=?, measurement=?, unit=?,
       period_target=?, minimum_target=?, overall_target=?, daily_action=?, evidence=?,
       deadline=?, active_days=?, share_progress=? WHERE id=? AND user_id=?`
  ).run(
    title, ownCategory(user.id, num(fd, "category_id")),
    str(fd, "why", 1000), str(fd, "measurement", 500), str(fd, "unit", 30),
    periodTarget, Math.max(0, Math.min(num(fd, "minimum_target") ?? 0, periodTarget)),
    num(fd, "overall_target"),
    str(fd, "daily_action", 500), str(fd, "evidence", 500),
    /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "deadline", 10)) ? str(fd, "deadline", 10) : null,
    days.length ? days.join(",") : "0,1,2,3,4,5,6",
    fd.get("share_progress") === "on" ? 1 : 0,
    id, user.id
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
  const goal = getDb().prepare("SELECT * FROM goals WHERE id=? AND user_id=?")
    .get(id, user.id) as { pauses_json: string; status: string } | undefined;
  if (!goal) return;
  const today = todayInTz(user.timezone);
  const db = getDb();
  const pauses = JSON.parse(goal.pauses_json || "[]") as { from: string; to?: string }[];
  if (action === "pause" && goal.status === "active") {
    pauses.push({ from: today });
    db.prepare("UPDATE goals SET status='paused', paused_at=?, pauses_json=? WHERE id=?")
      .run(today, JSON.stringify(pauses), id);
  } else if (action === "resume" && goal.status === "paused") {
    const open = pauses[pauses.length - 1];
    if (open && !open.to) open.to = today;
    db.prepare("UPDATE goals SET status='active', paused_at=NULL, pauses_json=? WHERE id=?")
      .run(JSON.stringify(pauses), id);
  } else if (action === "complete") {
    db.prepare("UPDATE goals SET status='completed', completed_at=? WHERE id=?")
      .run(new Date().toISOString(), id);
  } else if (action === "reactivate" && goal.status === "completed") {
    db.prepare("UPDATE goals SET status='active', completed_at=NULL WHERE id=?").run(id);
  } else if (action === "archive") {
    db.prepare("UPDATE goals SET status='archived' WHERE id=?").run(id);
  }
  revalidatePath("/goals");
  revalidatePath(`/goals/${id}`);
}

/** Log progress for a goal on a date (upsert). */
export async function checkinAction(goalId: number, date: string, value: number, note?: string) {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value)) return;
  const goal = getDb().prepare("SELECT id FROM goals WHERE id=? AND user_id=?")
    .get(goalId, user.id);
  if (!goal) return;
  const today = todayInTz(user.timezone);
  if (date > today) return; // no logging the future
  getDb().prepare(
    `INSERT INTO goal_checkins (goal_id, user_id, date, value, note)
     VALUES (?,?,?,?,?)
     ON CONFLICT (goal_id, date) DO UPDATE SET value=excluded.value,
       note=CASE WHEN excluded.note != '' THEN excluded.note ELSE goal_checkins.note END`
  ).run(goalId, user.id, date, Math.max(0, value), (note ?? "").slice(0, 500));
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
  getDb().prepare(
    `INSERT INTO calendar_events (user_id, title, date, start_min, end_min, category,
       color, notes, reminder_minutes) VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    user.id, title, date,
    parseClock(str(fd, "start_time")), parseClock(str(fd, "end_time")),
    EVENT_CATS.includes(str(fd, "category")) ? str(fd, "category") : "personal",
    safeColor(str(fd, "color", 9)), str(fd, "notes", 2000),
    num(fd, "reminder_minutes")
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
  getDb().prepare(
    `UPDATE calendar_events SET title=?, date=?, start_min=?, end_min=?, category=?,
       color=?, notes=?, reminder_minutes=? WHERE id=? AND user_id=?`
  ).run(
    title, date, parseClock(str(fd, "start_time")), parseClock(str(fd, "end_time")),
    EVENT_CATS.includes(str(fd, "category")) ? str(fd, "category") : "personal",
    safeColor(str(fd, "color", 9)), str(fd, "notes", 2000),
    num(fd, "reminder_minutes"), id, user.id
  );
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function deleteEventAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM calendar_events WHERE id=? AND user_id=?").run(id, user.id);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

/** Pin/unpin an event into one of the 3 dashboard countdown slots. */
export async function setCountdownAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  const slotRaw = num(fd, "slot");
  if (!id) return;
  const db = getDb();
  if (slotRaw === null || slotRaw === 0) {
    db.prepare("UPDATE calendar_events SET countdown_slot=NULL WHERE id=? AND user_id=?")
      .run(id, user.id);
  } else {
    const slot = Math.min(Math.max(Math.round(slotRaw), 1), 3);
    db.prepare("UPDATE calendar_events SET countdown_slot=NULL WHERE user_id=? AND countdown_slot=?")
      .run(user.id, slot);
    db.prepare("UPDATE calendar_events SET countdown_slot=? WHERE id=? AND user_id=?")
      .run(slot, id, user.id);
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
  getDb().prepare(
    `INSERT INTO timetable_entries (user_id, day_of_week, start_min, end_min, title, location, color)
     VALUES (?,?,?,?,?,?,?)`
  ).run(user.id, day, start, end, title, str(fd, "location", 80), safeColor(str(fd, "color", 9)));
  revalidatePath("/timetable");
}

export async function deleteTimetableEntryAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM timetable_entries WHERE id=? AND user_id=?").run(id, user.id);
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
  const db = getDb();
  const ins = db.prepare(
    `INSERT INTO timetable_entries (user_id, day_of_week, start_min, end_min, title, location, source)
     VALUES (?,?,?,?,?,?, 'import')`
  );
  const tx = db.transaction(() => {
    for (const e of entries.slice(0, 200)) {
      if (e.day_of_week < 0 || e.day_of_week > 6) continue;
      if (!(e.end_min > e.start_min)) continue;
      ins.run(user.id, Math.round(e.day_of_week), Math.round(e.start_min),
        Math.round(e.end_min), String(e.title).slice(0, 120), String(e.location).slice(0, 80));
    }
  });
  tx();
  revalidatePath("/timetable");
}

export async function uploadTimetableFileAction(fd: FormData) {
  const user = await requireUser();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 10 * 1024 * 1024) return;
  if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) return;
  const buf = Buffer.from(await file.arrayBuffer());
  getDb().prepare(
    "INSERT INTO timetable_uploads (user_id, filename, mime, data) VALUES (?,?,?,?)"
  ).run(user.id, file.name.slice(0, 120), file.type, buf);
  revalidatePath("/timetable");
}

export async function deleteTimetableUploadAction(fd: FormData) {
  const user = await requireUser();
  const id = num(fd, "id");
  if (!id) return;
  getDb().prepare("DELETE FROM timetable_uploads WHERE id=? AND user_id=?").run(id, user.id);
  revalidatePath("/timetable");
}

/** Copy today's timetable entries into the daily planner as scheduled tasks. */
export async function importTimetableToDayAction(fd: FormData) {
  const user = await requireUser();
  const date = str(fd, "date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const dow = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
  const db = getDb();
  const entries = db.prepare(
    "SELECT * FROM timetable_entries WHERE user_id=? AND day_of_week=? ORDER BY start_min"
  ).all(user.id, dow) as { start_min: number; end_min: number; title: string }[];
  const existing = db.prepare(
    "SELECT name, start_min FROM tasks WHERE user_id=? AND date=?"
  ).all(user.id, date) as { name: string; start_min: number | null }[];
  const ins = db.prepare(
    `INSERT INTO tasks (user_id, date, name, priority, planned_minutes, start_min, end_min)
     VALUES (?,?,?, 'B', ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const e of entries) {
      if (existing.some((x) => x.name === e.title && x.start_min === e.start_min)) continue;
      ins.run(user.id, date, e.title, e.end_min - e.start_min, e.start_min, e.end_min);
    }
  });
  tx();
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
  const db = getDb();
  // Any session still 'active' from a previous visit was abandoned mid-flight:
  // keep the history, mark it interrupted (integrity rule — no silent background running).
  db.prepare(
    `UPDATE focus_sessions SET status='interrupted', interrupt_reason='other',
       interrupt_note='Session left running and never resumed', ended_at=?
     WHERE user_id=? AND status='active'`
  ).run(new Date().toISOString(), user.id);
  const planned = Math.min(Math.max(Math.round(config.focusMinutes), 1), 12 * 60);
  db.prepare("UPDATE user_settings SET focus_defaults=? WHERE user_id=?")
    .run(JSON.stringify(config), user.id);
  const info = db.prepare(
    `INSERT INTO focus_sessions (user_id, date, started_at, planned_minutes, config_json, label, last_heartbeat)
     VALUES (?,?,?,?,?,?,?)`
  ).run(
    user.id, today, new Date().toISOString(), planned,
    JSON.stringify(config), String(config.label ?? "").slice(0, 120),
    new Date().toISOString()
  );
  return Number(info.lastInsertRowid);
}

export async function focusHeartbeatAction(id: number, focusSeconds: number) {
  const user = await requireUser();
  getDb().prepare(
    `UPDATE focus_sessions SET focus_seconds=?, last_heartbeat=?
      WHERE id=? AND user_id=? AND status='active'`
  ).run(clampSeconds(focusSeconds), new Date().toISOString(), id, user.id);
}

export async function completeFocusAction(id: number, focusSeconds: number) {
  const user = await requireUser();
  getDb().prepare(
    `UPDATE focus_sessions SET status='completed', focus_seconds=?, ended_at=?
      WHERE id=? AND user_id=? AND status='active'`
  ).run(clampSeconds(focusSeconds), new Date().toISOString(), id, user.id);
  revalidatePath("/focus");
  revalidatePath("/dashboard");
}

export async function interruptFocusAction(
  id: number, focusSeconds: number, reason: string, note: string
) {
  const user = await requireUser();
  const valid = ["distracted", "urgent", "unplanned_break", "technical", "other"];
  getDb().prepare(
    `UPDATE focus_sessions SET status='interrupted', focus_seconds=?, ended_at=?,
       interrupt_reason=?, interrupt_note=?
      WHERE id=? AND user_id=? AND status IN ('active','interrupted')`
  ).run(
    clampSeconds(focusSeconds), new Date().toISOString(),
    valid.includes(reason) ? reason : "other", String(note ?? "").slice(0, 300),
    id, user.id
  );
  revalidatePath("/focus");
}

/** Called on focus page load: sweep stale 'active' sessions (tab closed). */
export async function sweepStaleFocusAction() {
  const user = await requireUser();
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, last_heartbeat FROM focus_sessions WHERE user_id=? AND status='active'"
  ).all(user.id) as { id: number; last_heartbeat: string | null }[];
  const cutoff = Date.now() - 45_000; // 45s without a heartbeat = interrupted
  const stale = rows.filter(
    (r) => !r.last_heartbeat || Date.parse(r.last_heartbeat) < cutoff
  );
  for (const r of stale) {
    db.prepare(
      `UPDATE focus_sessions SET status='interrupted', ended_at=?
        WHERE id=? AND status='active'`
    ).run(new Date().toISOString(), r.id);
  }
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
  getDb().prepare(
    `INSERT INTO monthly_reviews (user_id, month, answers_json, submitted_at)
     VALUES (?,?,?,?)
     ON CONFLICT (user_id, month) DO UPDATE SET
       answers_json=excluded.answers_json,
       submitted_at=COALESCE(monthly_reviews.submitted_at, excluded.submitted_at)`
  ).run(user.id, month, json, submit ? new Date().toISOString() : null);
  revalidatePath("/review");
}

// ---------------- Demo data ----------------

export async function resetDemoDataAction() {
  const user = await requireUser();
  const db = getDb();
  const me = db.prepare("SELECT is_demo FROM users WHERE id=?").get(user.id) as { is_demo: number };
  if (!me?.is_demo) return; // only demo accounts can wipe demo data
  const { wipeDemoData } = await import("@/lib/seed-core");
  wipeDemoData();
  revalidatePath("/", "layout");
}

export async function reseedDemoDataAction() {
  const user = await requireUser();
  const db = getDb();
  const me = db.prepare("SELECT is_demo FROM users WHERE id=?").get(user.id) as { is_demo: number };
  if (!me?.is_demo) return;
  const { wipeDemoData, seedDemoData } = await import("@/lib/seed-core");
  wipeDemoData();
  seedDemoData();
  revalidatePath("/", "layout");
}
