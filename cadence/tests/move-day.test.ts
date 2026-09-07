import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { initDb, run, get, all } from "../lib/db";

/**
 * Moving a misplanned day must be a *rename of the date and nothing else* —
 * the whole point is that the plan arrives on the right day untouched.
 */

const TUE = "2026-09-08";
const MON = "2026-09-07";

async function setup() {
  process.env.CADENCE_DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "cadence-move-")), "t.db");
  delete process.env.TURSO_DATABASE_URL;
  await initDb();
  for (const t of ["tasks", "categories", "group_members", "users", "groups"])
    await run(`DELETE FROM ${t}`);

  for (const [id, name] of [[1, "khethiwe"], [2, "lethabo"]] as [number, string][]) {
    await run(
      `INSERT INTO users (id, username, display_name, password_hash, role, timezone, accent)
       VALUES (?,?,?,?, 'working', 'Africa/Johannesburg', '#a8c5b4')`,
      [id, name, name, "x"]
    );
  }
  await run("INSERT INTO categories (id, user_id, name, color) VALUES (7, 1, 'Work', '#b7c4d6')");

  // A realistic misdated day: timed and untimed, all three priorities, a
  // category, notes, a focus-session task, and one already ticked.
  const rows: [string, string, number | null, number | null, number | null, number, string, number][] = [
    ["Morning devotion", "A", 7, 300, 330, 0, "Psalms", 0],
    ["Deep work block", "A", 7, 480, 600, 0, "no phone", 1],
    ["Email + admin", "C", null, 660, 690, 1, "", 0],
    ["Gym", "B", null, 1080, 1140, 0, "legs", 0],
    ["Read 20 pages", "C", null, null, null, 0, "", 0],
  ];
  for (const [name, priority, cat, start, end, done, notes, focus] of rows) {
    await run(
      `INSERT INTO tasks (user_id, date, name, category_id, priority, planned_minutes,
         start_min, end_min, completed, completed_at, notes, focus_room)
       VALUES (1,?,?,?,?,?,?,?,?,?,?,?)`,
      [TUE, name, cat, priority, end !== null && start !== null ? end - start : 30,
       start, end, done, done ? "2026-09-08T11:30:00.000Z" : null, notes, focus]
    );
  }
  // Someone else's day on the same date — must not move.
  await run(
    "INSERT INTO tasks (user_id, date, name, priority) VALUES (2,?,'lethabo own task','A')", [TUE]
  );
  // And a task of ours on a neighbouring day — must not move either.
  await run(
    "INSERT INTO tasks (user_id, date, name, priority) VALUES (1,'2026-09-09','wednesday task','B')"
  );
}
let ready: Promise<void> | null = null;
const ensure = () => (ready ??= setup());

/** Mirrors moveDayTasksAction's single statement. */
const moveDay = (userId: number, from: string, to: string) =>
  run("UPDATE tasks SET date=? WHERE user_id=? AND date=?", [to, userId, from]);

type Task = Record<string, unknown>;
const dayOf = (userId: number, date: string) =>
  all<Task>("SELECT * FROM tasks WHERE user_id=? AND date=? ORDER BY id", [userId, date]);

test("every field except the date survives the move untouched", async () => {
  await ensure();
  const before = await dayOf(1, TUE);
  assert.equal(before.length, 5);

  await moveDay(1, TUE, MON);
  const after = await dayOf(1, MON);

  assert.equal(after.length, 5, "all five tasks arrive");
  for (let i = 0; i < before.length; i++) {
    const b = { ...before[i] }, a = { ...after[i] };
    assert.equal(a.date, MON);
    assert.equal(b.date, TUE);
    delete b.date; delete a.date;
    assert.deepEqual(a, b, `task "${b.name}" changed by more than its date`);
  }
});

test("times, priorities, categories, notes and ticks all come across", async () => {
  await ensure();
  const t = await dayOf(1, MON);
  const byName = new Map(t.map((x) => [x.name as string, x]));
  assert.deepEqual(
    t.map((x) => [x.name, x.priority, x.start_min, x.end_min]),
    [["Morning devotion", "A", 300, 330], ["Deep work block", "A", 480, 600],
     ["Email + admin", "C", 660, 690], ["Gym", "B", 1080, 1140],
     ["Read 20 pages", "C", null, null]]
  );
  assert.equal(byName.get("Morning devotion")!.category_id, 7);
  assert.equal(byName.get("Deep work block")!.focus_room, 1);
  assert.equal(byName.get("Deep work block")!.notes, "no phone");
  assert.equal(byName.get("Email + admin")!.completed, 1);
  assert.equal(byName.get("Email + admin")!.completed_at, "2026-09-08T11:30:00.000Z");
});

test("the tasks are not flagged as moved — they were never really on Tuesday", async () => {
  await ensure();
  const flagged = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tasks WHERE user_id=1 AND original_date IS NOT NULL"
  );
  assert.equal(flagged!.n, 0);
});

test("the source day is left empty and neighbouring days are untouched", async () => {
  await ensure();
  assert.equal((await dayOf(1, TUE)).length, 0);
  assert.equal((await dayOf(1, "2026-09-09")).length, 1);
});

test("nobody else's day is touched", async () => {
  await ensure();
  const theirs = await dayOf(2, TUE);
  assert.equal(theirs.length, 1);
  assert.equal(theirs[0].name, "lethabo own task");
  assert.equal((await dayOf(2, MON)).length, 0);
});

test("moving back is lossless, so a mistake is undoable", async () => {
  await ensure();
  const monday = await dayOf(1, MON);
  await moveDay(1, MON, TUE);
  const back = await dayOf(1, TUE);
  assert.deepEqual(
    back.map((t) => ({ ...t, date: undefined })),
    monday.map((t) => ({ ...t, date: undefined }))
  );
  await moveDay(1, TUE, MON); // leave it where the other tests expect
});

test("moving onto a day that already has tasks merges rather than replaces", async () => {
  await ensure();
  await run("INSERT INTO tasks (user_id, date, name, priority) VALUES (1,?,'already here','A')", [MON]);
  await run("INSERT INTO tasks (user_id, date, name, priority) VALUES (1,?,'stray tuesday task','B')", [TUE]);
  await moveDay(1, TUE, MON);
  const names = (await dayOf(1, MON)).map((t) => t.name);
  assert.ok(names.includes("already here"), "existing tasks stay");
  assert.ok(names.includes("stray tuesday task"), "moved task joins them");
  assert.equal(names.length, 7);
});
