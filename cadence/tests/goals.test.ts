import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGoalStats } from "../lib/goals";
import type { GoalRow, CheckinRow } from "../lib/types";

function goal(over: Partial<GoalRow> = {}): GoalRow {
  return {
    id: 1, user_id: 1, category_id: null, title: "Bible reading",
    why: "", measurement: "", tracking_type: "number", unit: "chapters",
    frequency: "daily", period_target: 3, minimum_target: 1, overall_target: null,
    daily_action: "", evidence: "", start_date: "2026-08-01", deadline: null,
    active_days: "0,1,2,3,4,5,6", status: "active", paused_at: null,
    pauses_json: "[]", completed_at: null, share_progress: 1,
    ...over,
  };
}

function ci(date: string, value: number): CheckinRow {
  return { id: 0, goal_id: 1, user_id: 1, date, value, note: "" };
}

test("daily goal: completion, streaks, missed days", () => {
  // Aug 1..5, today = Aug 5. Done 1,2,4; missed 3; today logged partially.
  const s = computeGoalStats(goal(), [
    ci("2026-08-01", 3), ci("2026-08-02", 3), ci("2026-08-04", 3), ci("2026-08-05", 1),
  ], "2026-08-05");
  assert.equal(s.elapsedPeriods, 4);           // 1..4 finished
  assert.equal(s.completedPeriods, 3);
  assert.equal(s.missedPeriods, 1);
  assert.equal(s.consistencyPct, 75);
  assert.equal(s.currentStreak, 1);            // Aug 4 done; today in progress doesn't break
  assert.equal(s.longestStreak, 2);            // Aug 1–2
  assert.equal(s.todayTarget, 3);
  assert.equal(s.todayValue, 1);
  // overall: earned = 3+3+0+3+1=10 (capped per day), possible = 5*3
  assert.equal(s.overallPct, Math.round((10 / 15) * 100));
});

test("incomplete today does not break the current streak", () => {
  const s = computeGoalStats(goal(), [
    ci("2026-08-03", 3), ci("2026-08-04", 3),
  ], "2026-08-05");
  assert.equal(s.currentStreak, 2);
});

test("weekly frequency goal counts sessions across the week", () => {
  const g = goal({ frequency: "weekly", period_target: 4, tracking_type: "frequency", start_date: "2026-08-03" });
  // Week of Mon Aug 3: 4 sessions → complete. Week of Aug 10: 2 so far, today Wed Aug 12.
  const s = computeGoalStats(g, [
    ci("2026-08-03", 1), ci("2026-08-04", 1), ci("2026-08-06", 1), ci("2026-08-08", 1),
    ci("2026-08-10", 1), ci("2026-08-11", 1),
  ], "2026-08-12");
  assert.equal(s.elapsedPeriods, 1);
  assert.equal(s.completedPeriods, 1);
  assert.equal(s.currentPeriod?.value, 2);
  assert.equal(s.currentPeriod?.target, 4);
  assert.equal(s.currentStreak, 1);
  assert.equal(s.weekValue, 2);
});

test("active_days: weekdays-only goal ignores weekends", () => {
  const g = goal({ active_days: "0,1,2,3,4", start_date: "2026-08-03" }); // Mon 3rd
  // Sat 8 & Sun 9 don't count. Mon..Fri done. today = Mon Aug 10.
  const s = computeGoalStats(g, [
    ci("2026-08-03", 3), ci("2026-08-04", 3), ci("2026-08-05", 3),
    ci("2026-08-06", 3), ci("2026-08-07", 3),
  ], "2026-08-10");
  assert.equal(s.elapsedPeriods, 5);
  assert.equal(s.missedPeriods, 0);
  assert.equal(s.currentStreak, 5);
});

test("paused interval excludes those days from stats", () => {
  const g = goal({ pauses_json: JSON.stringify([{ from: "2026-08-03", to: "2026-08-05" }]) });
  // Aug 1,2 done; 3,4 paused (excluded); 5 resumed+done. today Aug 6.
  const s = computeGoalStats(g, [
    ci("2026-08-01", 3), ci("2026-08-02", 3), ci("2026-08-05", 3),
  ], "2026-08-06");
  assert.equal(s.elapsedPeriods, 3); // 1,2,5 (6 in progress)
  assert.equal(s.missedPeriods, 0);
  assert.equal(s.currentStreak, 3);
});

test("overall_target uses cumulative progress", () => {
  const g = goal({
    frequency: "monthly", period_target: 2500, overall_target: 30000,
    start_date: "2026-06-01", unit: "R",
  });
  const s = computeGoalStats(g, [
    ci("2026-06-25", 2500), ci("2026-07-25", 2500),
  ], "2026-08-10");
  assert.equal(s.cumulativeValue, 5000);
  assert.equal(s.overallPct, Math.round((5000 / 30000) * 100));
  assert.equal(s.elapsedPeriods, 2);
  assert.equal(s.completedPeriods, 2);
});

test("goal completed early: overallPct is 100 and periods stop at completion", () => {
  const g = goal({ status: "completed", completed_at: "2026-08-03T10:00:00Z" });
  const s = computeGoalStats(g, [ci("2026-08-01", 3), ci("2026-08-02", 3), ci("2026-08-03", 3)], "2026-08-10");
  assert.equal(s.overallPct, 100);
  assert.equal(s.periods.length, 3);
});

test("deadline caps the counted periods", () => {
  const g = goal({ deadline: "2026-08-04" });
  const s = computeGoalStats(g, [ci("2026-08-01", 3)], "2026-08-20");
  assert.equal(s.periods.length, 4); // Aug 1..4 only
  assert.equal(s.todayTarget, null); // past deadline: not due today
});

test("boolean goal treats 1 as complete", () => {
  const g = goal({ tracking_type: "boolean", period_target: 1, minimum_target: 0 });
  const s = computeGoalStats(g, [ci("2026-08-01", 1), ci("2026-08-02", 1)], "2026-08-03");
  assert.equal(s.completedPeriods, 2);
  assert.equal(s.currentStreak, 2);
});
