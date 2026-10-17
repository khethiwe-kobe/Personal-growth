import { test } from "node:test";
import assert from "node:assert/strict";
import { plannedPerWeek, scoreboard, scoreMember, weekStreak, type MemberProgress } from "../lib/scoring";
import { addDays, dayOf, weekStart } from "../lib/time";
import type { Programme, WorkoutLog } from "../lib/types";

const log = (date: string, completed = true): WorkoutLog => ({ id: date + completed, date, session: "S", completed, exercises: [] });
const prog = (days: string[]): Programme => ({
  title: "P",
  summary: "",
  blocks: [],
  principles: [],
  updated_at: "",
  schedule: days.map((d, i) => ({ day: `D${i}`, session: d, focus: "", duration_min: d === "Rest" ? 0 : 45 })),
});

test("dates follow Johannesburg time and weeks start on Monday", () => {
  assert.equal(dayOf(new Date("2026-10-12T22:30:00Z")), "2026-10-13"); // 00:30 SAST
  assert.equal(weekStart("2026-10-13"), "2026-10-12");
  assert.equal(weekStart("2026-10-18"), "2026-10-12");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("planned sessions per week ignore rest days", () => {
  assert.equal(plannedPerWeek(null), 3);
  assert.equal(plannedPerWeek(prog(["Lower", "Rest", "Upper", "Rest", "Power", "Long", "Rest"])), 4);
});

test("week streak counts consecutive weeks that hit the target", () => {
  const today = "2026-10-14"; // Wednesday
  const logs = [
    log("2026-09-28"), log("2026-09-30"), // 2 in week of 28 Sep
    log("2026-10-05"), log("2026-10-07"), // 2 in week of 5 Oct
    log("2026-10-12"), // 1 so far this week
  ];
  assert.equal(weekStreak(logs, 2, today), 2);
  assert.equal(weekStreak([...logs, log("2026-10-13")], 2, today), 3);
  assert.equal(weekStreak([log("2026-09-28"), log("2026-09-30"), log("2026-10-12"), log("2026-10-13")], 2, today), 1);
});

test("points: sessions, photos, baselines and bests, with a cap per day", () => {
  const m: MemberProgress = {
    id: "a",
    name: "A",
    programme: null,
    logs: [log("2026-10-12"), log("2026-10-12", false), log("2026-10-12"), log("2026-10-13")],
    metrics: [
      { id: "1", key: "pull_ups", label: "Pull-ups", value: 5, unit: "reps", date: "2026-10-12" },
      { id: "2", key: "pull_ups", label: "Pull-ups", value: 4, unit: "reps", date: "2026-10-13" },
      { id: "3", key: "pull_ups", label: "Pull-ups", value: 7, unit: "reps", date: "2026-10-14" },
      { id: "4", key: "run", label: "1.5 mile run", value: 780, unit: "s", date: "2026-10-12" },
      { id: "5", key: "run", label: "1.5 mile run", value: 750, unit: "s", date: "2026-10-14" },
    ],
    photoDays: ["2026-10-12", "2026-10-13", "2026-10-13"],
  };
  const r = scoreMember(m, "week", "2026-10-14");
  // Day 12: complete 10 + partial 5 (third session capped); day 13: 10.
  // Photos: 2 days x 3. Baselines: 2 x 2. Bests: pull-ups 7, run 750 = 2 x 5.
  assert.equal(r.points, 25 + 6 + 4 + 10);
  assert.equal(r.sessions, 2);
  assert.equal(r.bests, 2);
  assert.equal(r.photos, 2);
  assert.ok(r.improvement !== null && r.improvement > 0);
});

test("weekly scoreboard ignores last week and shares ranks on ties", () => {
  const base = { programme: null, metrics: [], photoDays: [] };
  const rows = scoreboard(
    [
      { ...base, id: "a", name: "Ama", logs: [log("2026-10-12")] },
      { ...base, id: "b", name: "Ben", logs: [log("2026-10-13")] },
      { ...base, id: "c", name: "Cal", logs: [log("2026-10-05"), log("2026-10-06")] },
    ],
    "week",
    "2026-10-14",
  );
  assert.deepEqual(rows.map((r) => [r.name, r.points, r.rank]), [["Ama", 10, 1], ["Ben", 10, 1], ["Cal", 0, 3]]);
});
