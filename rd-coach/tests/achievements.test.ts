import { test } from "node:test";
import assert from "node:assert/strict";
import { postsForSave } from "../lib/coach/achievements";
import { applyTool } from "../lib/coach/apply";
import { EMPTY_STATE, type CoachState } from "../lib/types";

let n = 0;
const id = () => `id${++n}`;

test("a logged session becomes a post, and hitting the week target adds a second", () => {
  let s: CoachState = { ...EMPTY_STATE };
  const save = (input: unknown) => {
    const after = applyTool(s, "log_workout", input, id);
    const posts = postsForSave(s, after, "log_workout", "2026-10-14");
    s = after;
    return posts;
  };
  assert.deepEqual(save({ date: "2026-10-12", session: "Lower", completed: true, exercises: [] }).map((p) => p.kind), ["session"]);
  assert.deepEqual(save({ date: "2026-10-13", session: "Upper", completed: true, exercises: [] }).map((p) => p.kind), ["session"]);
  const third = save({ date: "2026-10-14", session: "Power", completed: true, exercises: [{ name: "Box jump", sets: 4, reps: "5" }] });
  assert.deepEqual(third.map((p) => p.kind), ["session", "week_goal"]);
  assert.equal(third[1].data.planned, 3);
  assert.deepEqual(save({ date: "2026-10-15", session: "Run", completed: true, exercises: [] }).map((p) => p.kind), ["session"]);
});

test("first reading is a baseline; only improvements are posted after that", () => {
  let s: CoachState = { ...EMPTY_STATE };
  const rec = (value: number, date: string, key = "pull_ups", unit = "reps", label = "Pull-ups") => {
    const after = applyTool(s, "record_metric", { key, label, value, unit, date }, id);
    const posts = postsForSave(s, after, "record_metric", date);
    s = after;
    return posts;
  };
  assert.equal(rec(5, "2026-10-01")[0].kind, "baseline");
  assert.equal(rec(4, "2026-10-08").length, 0);
  const best = rec(7, "2026-10-15");
  assert.equal(best[0].kind, "best");
  assert.equal(best[0].data.previous, 5);
  assert.equal(rec(800, "2026-10-01", "run", "s", "1.5 mile run")[0].kind, "baseline");
  assert.equal(rec(760, "2026-10-15", "run", "s", "1.5 mile run")[0].kind, "best");
});

test("only the first programme is announced", () => {
  const prog = { title: "RD prep", summary: "x", blocks: [], schedule: [], principles: [] };
  const a = applyTool({ ...EMPTY_STATE }, "save_programme", prog, id);
  assert.equal(postsForSave({ ...EMPTY_STATE }, a, "save_programme", "2026-10-14")[0].kind, "programme");
  const b = applyTool(a, "save_programme", { ...prog, title: "v2" }, id);
  assert.equal(postsForSave(a, b, "save_programme", "2026-10-14").length, 0);
});
