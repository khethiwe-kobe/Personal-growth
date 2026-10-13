import { test } from "node:test";
import assert from "node:assert/strict";
import { applyTool } from "../lib/coach/apply";
import { EMPTY_STATE, type CoachState } from "../lib/types";

let n = 0;
const id = () => `id${++n}`;
const base: CoachState = { ...EMPTY_STATE };

test("update_profile merges fields", () => {
  const s1 = applyTool(base, "update_profile", { fields: { age: 28, weight_kg: 82 } }, id);
  const s2 = applyTool(s1, "update_profile", { fields: { weight_kg: 80, injuries: "none" } }, id);
  assert.deepEqual(s2.profile, { age: 28, weight_kg: 80, injuries: "none" });
});

test("record_metric keeps one value per key per day, sorted by date", () => {
  let s = applyTool(base, "record_metric", { key: "pull_ups", label: "Pull-ups", value: 5, unit: "reps", date: "2026-10-13" }, id);
  s = applyTool(s, "record_metric", { key: "pull_ups", label: "Pull-ups", value: 6, unit: "reps", date: "2026-10-13" }, id);
  s = applyTool(s, "record_metric", { key: "pull_ups", label: "Pull-ups", value: 4, unit: "reps", date: "2026-10-01" }, id);
  assert.equal(s.metrics.length, 2);
  assert.deepEqual(s.metrics.map((m) => m.value), [4, 6]);
});

test("invalid input leaves state untouched", () => {
  const s = applyTool(base, "record_metric", { key: "x", value: "five" }, id);
  assert.equal(s, base);
  const t = applyTool(base, "not_a_tool", {}, id);
  assert.equal(t, base);
});

test("save_programme replaces and stamps updated_at", () => {
  const prog = {
    title: "RD prep",
    summary: "Four blocks.",
    blocks: [{ name: "Base", weeks: "1-4", focus: "Strength" }],
    schedule: [{ day: "Monday", session: "Lower", focus: "Squat", duration_min: 60 }],
    principles: ["Progress slowly"],
  };
  const s = applyTool(base, "save_programme", prog, id);
  assert.equal(s.programme?.title, "RD prep");
  assert.ok(s.programme?.updated_at);
});

test("log_workout prepends newest first", () => {
  let s = applyTool(base, "log_workout", { date: "2026-10-10", session: "A", completed: true, exercises: [] }, id);
  s = applyTool(s, "log_workout", { date: "2026-10-12", session: "B", completed: false, exercises: [{ name: "Squat", sets: 4, reps: "5", load: "80 kg" }] }, id);
  assert.deepEqual(s.logs.map((l) => l.session), ["B", "A"]);
});

test("set_phase moves the phase", () => {
  const s = applyTool(base, "set_phase", { phase: "training" }, id);
  assert.equal(s.phase, "training");
});
