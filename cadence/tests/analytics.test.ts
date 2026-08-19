import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeDaySummary, mergeIntervals, unaccountedGaps,
  productiveDayStreak, ACCOUNT_START, ACCOUNT_END,
} from "../lib/analytics";
import type { TaskRow, TimeBlockRow, FocusSessionRow } from "../lib/types";

let nextId = 1;
function task(over: Partial<TaskRow> = {}): TaskRow {
  return {
    id: nextId++, user_id: 1, date: "2026-08-10", name: "t",
    category_id: null, priority: "B", planned_minutes: 60,
    start_min: null, end_min: null, completed: 0, completed_at: null,
    notes: "", original_date: null, ...over,
  };
}
function block(start: number, end: number, kind = "break"): TimeBlockRow {
  return { id: nextId++, user_id: 1, date: "2026-08-10", start_min: start, end_min: end, kind, label: "" };
}
function focus(seconds: number, status: FocusSessionRow["status"]): FocusSessionRow {
  return {
    id: nextId++, user_id: 1, date: "2026-08-10", started_at: "", ended_at: null,
    planned_minutes: 60, focus_seconds: seconds, status, interrupt_reason: null,
    interrupt_note: "", label: "", config_json: "{}", last_heartbeat: null,
  };
}

test("mergeIntervals merges overlapping task times", () => {
  const merged = mergeIntervals([
    { start: 480, end: 600 }, { start: 540, end: 660 }, { start: 700, end: 720 },
  ]);
  assert.deepEqual(merged, [{ start: 480, end: 660 }, { start: 700, end: 720 }]);
});

test("unaccounted gaps computed within the 06:00–22:00 window", () => {
  const gaps = unaccountedGaps([{ start: 360, end: 1200 }]);
  assert.deepEqual(gaps, [{ start: 1200, end: ACCOUNT_END }]);
  const none = unaccountedGaps([{ start: 0, end: 24 * 60 }]);
  assert.deepEqual(none, []);
});

test("day summary: counts, percentages, priorities, score parts", () => {
  const tasks = [
    task({ priority: "A", completed: 1, planned_minutes: 60, completed_at: "2026-08-10T12:00:00Z" }),
    task({ priority: "A", completed: 1, planned_minutes: 30, completed_at: "2026-08-10T14:00:00Z" }),
    task({ priority: "B", completed: 0, planned_minutes: 90 }),
    task({ priority: "C", completed: 0, planned_minutes: 30 }),
  ];
  const s = computeDaySummary({
    date: "2026-08-10", tasks, blocks: [], focus: [],
    goalsDue: 2, goalsCompleted: 1, nowMin: null,
  });
  assert.equal(s.tasksPlanned, 4);
  assert.equal(s.tasksCompleted, 2);
  assert.equal(s.completionPct, 50);
  assert.equal(s.plannedMinutes, 210);
  assert.equal(s.completedMinutes, 90);
  assert.equal(s.byPriority.A.completed, 2);
  assert.equal(s.overdueTasks, 2); // past day, unfinished
  // score: .45*(.5) + .25*(90/210) + .3*(.5) → renormalised weights sum to 1 already
  const expected = Math.round((0.45 * 0.5 + 0.25 * (90 / 210) + 0.3 * 0.5) * 100);
  assert.equal(s.score, expected);
  assert.equal(s.scoreParts.length, 3);
});

test("scheduled task minutes use the schedule, not the estimate", () => {
  const s = computeDaySummary({
    date: "2026-08-10",
    tasks: [task({ start_min: 480, end_min: 600, planned_minutes: 30, completed: 1, completed_at: "2026-08-10T12:00:00Z" })],
    blocks: [], focus: [], goalsDue: 0, goalsCompleted: 0, nowMin: null,
  });
  assert.equal(s.plannedMinutes, 120);
  assert.equal(s.completedMinutes, 120);
});

test("empty day scores 0 with no parts (rest day, not failure)", () => {
  const s = computeDaySummary({
    date: "2026-08-10", tasks: [], blocks: [], focus: [],
    goalsDue: 0, goalsCompleted: 0, nowMin: null,
  });
  assert.equal(s.score, 0);
  assert.equal(s.scoreParts.length, 0);
});

test("today: overdue only counts tasks whose end time passed", () => {
  const s = computeDaySummary({
    date: "2026-08-10",
    tasks: [
      task({ start_min: 480, end_min: 540 }),   // ended 09:00 — overdue
      task({ start_min: 900, end_min: 960 }),   // later — not overdue
      task({}),                                  // no schedule — not overdue yet
    ],
    blocks: [], focus: [], goalsDue: 0, goalsCompleted: 0, nowMin: 600,
  });
  assert.equal(s.overdueTasks, 1);
});

test("today: future gaps don't count as unaccounted yet", () => {
  const s = computeDaySummary({
    date: "2026-08-10",
    tasks: [task({ start_min: ACCOUNT_START, end_min: 480 })], // 06:00–08:00 covered
    blocks: [], focus: [], goalsDue: 0, goalsCompleted: 0,
    nowMin: 540, // 09:00 → only 08:00–09:00 gap has elapsed
  });
  assert.equal(s.unaccountedMinutes, 60);
});

test("focus minutes ignore still-active sessions; interrupted kept in history", () => {
  const s = computeDaySummary({
    date: "2026-08-10", tasks: [], blocks: [],
    focus: [focus(3600, "completed"), focus(600, "interrupted"), focus(999, "active")],
    goalsDue: 0, goalsCompleted: 0, nowMin: null,
  });
  assert.equal(s.focusMinutes, 70);
  assert.equal(s.focusSessions, 2);
  assert.equal(s.focusInterrupted, 1);
});

test("late completion is detected", () => {
  const s = computeDaySummary({
    date: "2026-08-10",
    tasks: [task({ completed: 1, completed_at: "2026-08-12T09:00:00Z" })],
    blocks: [], focus: [], goalsDue: 0, goalsCompleted: 0, nowMin: null,
  });
  assert.equal(s.lateCompletions, 1);
});

test("productive day streak: today in progress doesn't break it", () => {
  const mk = (date: string, score: number) => ({ date, score, tasksPlanned: 3, goalsDue: 1 });
  const streak = productiveDayStreak(
    [mk("2026-08-07", 80), mk("2026-08-08", 75), mk("2026-08-09", 90), mk("2026-08-10", 10)],
    "2026-08-10"
  );
  assert.equal(streak, 3);
});
