import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { initDb, run, get, all } from "../lib/db";
import * as rooms from "../lib/rooms";

async function setup() {
  // Its own throwaway database — read lazily, so setting it here is in time.
  process.env.CADENCE_DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "cadence-rooms-")), "t.db");
  delete process.env.TURSO_DATABASE_URL;
  await initDb();
  // initDb bootstraps a starter group so a fresh deployment can sign up; these
  // tests want an empty world.
  for (const t of ["focus_room_members", "focus_rooms", "tasks", "group_members", "users", "groups"])
    await run(`DELETE FROM ${t}`);

// --- fixtures: one group, three friends, one focus task each ---
await run("INSERT INTO groups (id, name, invite_code) VALUES (1,'Trio','ABC')");
const users = ["khethiwe", "lethabo", "aldonia"];
for (let i = 0; i < 3; i++) {
  await run(
    "INSERT INTO users (id, username, display_name, password_hash, role, timezone, accent) VALUES (?,?,?,?,?,?,?)",
    [i + 1, users[i], users[i], "x", "student", "Africa/Johannesburg", "#a8c5b4"]
  );
  await run("INSERT INTO group_members (group_id, user_id) VALUES (1, ?)", [i + 1]);
  await run(
    "INSERT INTO tasks (user_id, date, name, priority, focus_room, planned_minutes) VALUES (?, '2026-08-22', ?, 'A', 1, 60)",
    [i + 1, `${users[i]}'s private task`]
  );
}
}
let ready: Promise<void> | null = null;
const ensure = () => (ready ??= setup());

const taskOf = async (uid: number) =>
  (await get<{ id: number }>("SELECT id FROM tasks WHERE user_id=?", [uid]))!.id;

// Mirrors joinFocusRoomAction: find-or-create one open room per group.
async function join(uid: number) {
  let room = await rooms.openRoomForGroup(1);
  if (!room) {
    await run(
      "INSERT INTO focus_rooms (group_id, task_id, opened_by, title, date) VALUES (1,NULL,?,?,'2026-08-22')",
      [uid, rooms.ROOM_TITLE]
    );
    room = await rooms.openRoomForGroup(1);
  }
  return room!;
}
async function enter(roomId: number, uid: number, taskId: number | null) {
  await run("INSERT INTO focus_room_members (room_id, user_id, task_id) VALUES (?,?,?)",
    [roomId, uid, taskId]);
}

test("all three land in the same room whichever task they start from", async () => {
  await ensure();
  const ids: number[] = [];
  for (const uid of [1, 2, 3]) ids.push((await join(uid)).id);
  assert.equal(new Set(ids).size, 1, "everyone must get one room, not three");
  const n = await get<{ n: number }>("SELECT COUNT(*) AS n FROM focus_rooms");
  assert.equal(n!.n, 1);
});

test("the room is never named after anyone's task", async () => {
  await ensure();
  const room = await rooms.openRoomForGroup(1);
  assert.equal(room!.title, "Focus room");
  assert.equal(room!.task_id, null);
  const names = await all<{ name: string }>("SELECT name FROM tasks");
  for (const { name } of names)
    assert.ok(!room!.title.includes(name), `room title leaked "${name}"`);
});

test("each member keeps their own task, invisible to the others", async () => {
  await ensure();
  const room = (await rooms.openRoomForGroup(1))!;
  for (const uid of [1, 2, 3]) await enter(room.id, uid, await taskOf(uid));
  for (const uid of [1, 2, 3])
    assert.equal(await rooms.memberTask(room.id, uid), await taskOf(uid));
  // roomMembers is what the room UI renders — it must carry no task names.
  const members = await rooms.roomMembers(room.id);
  assert.equal(members.length, 3);
  const rendered = JSON.stringify(members);
  for (const uid of [1, 2, 3]) {
    const t = await get<{ name: string }>("SELECT name FROM tasks WHERE user_id=?", [uid]);
    assert.ok(!rendered.includes(t!.name), `member payload leaked "${t!.name}"`);
  }
});

test("presence is credited to the member's own task, not the opener's", async () => {
  await ensure();
  const room = (await rooms.openRoomForGroup(1))!;
  await run("UPDATE focus_room_members SET present_secs=300 WHERE room_id=? AND user_id=2",
    [room.id]);
  assert.equal(await rooms.presenceForTask(await taskOf(2), 2), 300);
  // Lethabo's time must not unlock Khethiwe's task.
  assert.equal(await rooms.presenceForTask(await taskOf(1), 1), 0);
  assert.equal(await rooms.presenceForTask(await taskOf(2), 1), 0);
});

test("planner status reads from the member's task", async () => {
  await ensure();
  const map = await rooms.focusPresenceForTasks(2, [await taskOf(1), await taskOf(2)]);
  assert.equal(map.get(await taskOf(2))!.secs, 300);
  assert.equal(map.get(await taskOf(1)), undefined);
});

test("legacy rooms bound to a task still resolve", async () => {
  await ensure();
  // A room from before the change: task on the room, none on the member.
  const t = await taskOf(3);
  await run(
    "INSERT INTO focus_rooms (id, group_id, task_id, opened_by, title, date, closed_at) VALUES (99,1,?,3,'old title','2026-08-01',datetime('now'))",
    [t]
  );
  await run(
    "INSERT INTO focus_room_members (room_id, user_id, task_id, present_secs) VALUES (99,3,NULL,420)"
  );
  assert.equal(await rooms.presenceForTask(t, 3), 420);
  const map = await rooms.focusPresenceForTasks(3, [t]);
  assert.equal(map.get(t)!.secs, 420);
});

test("a closed room does not trap the group; a new one opens", async () => {
  await ensure();
  const room = (await rooms.openRoomForGroup(1))!;
  await run("UPDATE focus_rooms SET closed_at=datetime('now') WHERE id=?", [room.id]);
  assert.equal(await rooms.openRoomForGroup(1), undefined);
  const fresh = await join(1);
  assert.notEqual(fresh.id, room.id);
});

test("another group's room is never picked up", async () => {
  await ensure();
  await run("INSERT INTO groups (id, name, invite_code) VALUES (2,'Other','XYZ')");
  const mine = (await rooms.openRoomForGroup(1))!;
  const theirs = await rooms.openRoomForGroup(2);
  assert.equal(theirs, undefined);
  assert.equal(mine.group_id, 1);
});
