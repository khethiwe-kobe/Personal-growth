import type { GoalRow, CheckinRow } from "./types";
import {
  addDays, startOfWeek, monthOf, weekdayIndex, diffDays, monthDates,
} from "./time";

/**
 * Goal progress engine — pure functions over goal + check-in rows so the
 * numbers are testable and identical everywhere they appear.
 *
 * A goal defines a recurring requirement:
 *   frequency 'daily'   → each active weekday requires `period_target`
 *   frequency 'weekly'  → each Mon–Sun week requires `period_target`
 *   frequency 'monthly' → each calendar month requires `period_target`
 *
 * Check-ins store one value per date; period value = sum of its dates.
 * Everything else (streaks, consistency, overall %) is derived.
 */

export type PeriodStat = {
  key: string;          // date, week-start date, or YYYY-MM
  start: string;
  end: string;
  value: number;
  target: number;
  complete: boolean;    // value >= target
  minimumMet: boolean;  // value >= minimum (or complete)
  inProgress: boolean;  // period contains `today`
  excluded: boolean;    // fell inside a pause interval
};

export type GoalStats = {
  goalId: number;
  periods: PeriodStat[];        // chronological, excluding excluded periods
  elapsedPeriods: number;       // finished periods (not counting the current one)
  completedPeriods: number;     // finished periods fully complete
  missedPeriods: number;
  consistencyPct: number;       // completed / elapsed finished periods
  overallPct: number;           // see computeOverallPct
  currentStreak: number;
  longestStreak: number;
  currentPeriod: PeriodStat | null;
  cumulativeValue: number;
  weekValue: number;            // value logged this Mon–Sun week
  weekTarget: number;           // expected this week
  todayValue: number;
  todayTarget: number | null;   // null when the goal isn't due today
};

type Pause = { from: string; to?: string };

function pauses(goal: GoalRow): Pause[] {
  try {
    const arr = JSON.parse(goal.pauses_json || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function dateExcluded(goal: GoalRow, date: string): boolean {
  return pauses(goal).some(
    (p) => date >= p.from && (p.to === undefined || p.to === null || date < p.to)
  );
}

function activeDaysSet(goal: GoalRow): Set<number> {
  const s = new Set<number>();
  for (const part of goal.active_days.split(",")) {
    const n = Number(part.trim());
    if (n >= 0 && n <= 6) s.add(n);
  }
  return s.size ? s : new Set([0, 1, 2, 3, 4, 5, 6]);
}

/** Last date that counts toward the goal (completion, deadline or today). */
function horizon(goal: GoalRow, today: string): string {
  let end = today;
  if (goal.deadline && goal.deadline < end) end = goal.deadline;
  if (goal.status === "completed" && goal.completed_at) {
    const done = goal.completed_at.slice(0, 10);
    if (done < end) end = done;
  }
  return end;
}

export function computeGoalStats(
  goal: GoalRow,
  checkins: CheckinRow[],
  today: string
): GoalStats {
  const byDate = new Map<string, number>();
  for (const c of checkins) byDate.set(c.date, (byDate.get(c.date) ?? 0) + c.value);

  const end = horizon(goal, today);
  const target = Math.max(goal.period_target, 0.000001);
  const minimum = goal.minimum_target > 0 ? goal.minimum_target : goal.period_target;
  const active = activeDaysSet(goal);
  const periods: PeriodStat[] = [];

  const push = (key: string, start: string, pEnd: string) => {
    let value = 0;
    for (let d = start; d <= pEnd; d = addDays(d, 1)) value += byDate.get(d) ?? 0;
    const excluded = dateExcluded(goal, start);
    const inProgress = today >= start && today <= pEnd && goal.status !== "completed";
    periods.push({
      key, start, end: pEnd, value,
      target: goal.period_target,
      complete: value >= goal.period_target,
      minimumMet: value >= minimum || value >= goal.period_target,
      inProgress, excluded,
    });
  };

  if (goal.start_date <= end) {
    if (goal.frequency === "daily") {
      for (let d = goal.start_date; d <= end; d = addDays(d, 1)) {
        if (!active.has(weekdayIndex(d))) continue;
        push(d, d, d);
      }
    } else if (goal.frequency === "weekly") {
      for (let w = startOfWeek(goal.start_date); w <= end; w = addDays(w, 7)) {
        push(w, w < goal.start_date ? goal.start_date : w, min(addDays(w, 6), end));
      }
    } else {
      for (let m = monthOf(goal.start_date); m <= monthOf(end); m = nextMonth(m)) {
        const dates = monthDates(m);
        push(m, max(dates[0], goal.start_date), min(dates[dates.length - 1], end));
      }
    }
  }

  const counted = periods.filter((p) => !p.excluded);
  const finished = counted.filter((p) => !p.inProgress);
  const completedPeriods = finished.filter((p) => p.complete).length;
  const missedPeriods = finished.length - completedPeriods;
  const consistencyPct = finished.length
    ? Math.round((completedPeriods / finished.length) * 100)
    : 0;

  // Overall %: cumulative toward an overall target when one exists;
  // otherwise "credit earned vs credit possible so far" (partial credit,
  // capped at 100% per period so one huge day can't erase missed days).
  const cumulativeValue = counted.reduce((s, p) => s + p.value, 0);
  let overallPct: number;
  if (goal.overall_target && goal.overall_target > 0) {
    overallPct = Math.min(100, Math.round((cumulativeValue / goal.overall_target) * 100));
  } else {
    const possible = counted.length * target;
    const earned = counted.reduce((s, p) => s + Math.min(p.value, target), 0);
    overallPct = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  }
  if (goal.status === "completed") overallPct = Math.max(overallPct, 100);

  // Streaks over counted periods; the current in-progress period only helps,
  // never hurts (an incomplete "today" doesn't break the streak yet).
  let longestStreak = 0, run = 0;
  for (const p of counted) {
    if (p.complete) { run++; longestStreak = Math.max(longestStreak, run); }
    else if (!p.inProgress) run = 0;
  }
  let currentStreak = 0;
  for (let i = counted.length - 1; i >= 0; i--) {
    const p = counted[i];
    if (p.complete) currentStreak++;
    else if (p.inProgress) continue;
    else break;
  }

  const currentPeriod = counted.find((p) => p.inProgress) ?? null;

  // This-week rollup (used on dashboards + shared views).
  const ws = startOfWeek(today);
  const we = addDays(ws, 6);
  let weekValue = 0;
  for (let d = ws; d <= we; d = addDays(d, 1)) weekValue += byDate.get(d) ?? 0;
  let weekTarget = 0;
  if (goal.frequency === "daily") {
    for (let d = ws; d <= we; d = addDays(d, 1)) {
      if (d >= goal.start_date && d <= end && active.has(weekdayIndex(d)) && !dateExcluded(goal, d))
        weekTarget += goal.period_target;
    }
  } else if (goal.frequency === "weekly") {
    weekTarget = goal.period_target;
  } else {
    weekTarget = (goal.period_target / monthDates(monthOf(today)).length) * 7;
  }

  const dueToday =
    goal.status === "active" &&
    goal.frequency === "daily" &&
    goal.start_date <= today && today <= end &&
    active.has(weekdayIndex(today)) &&
    !dateExcluded(goal, today);

  return {
    goalId: goal.id,
    periods: counted,
    elapsedPeriods: finished.length,
    completedPeriods,
    missedPeriods,
    consistencyPct,
    overallPct,
    currentStreak,
    longestStreak,
    currentPeriod,
    cumulativeValue,
    weekValue,
    weekTarget: round1(weekTarget),
    todayValue: byDate.get(today) ?? 0,
    todayTarget: dueToday ? goal.period_target : null,
  };
}

/** Goals due today (daily) or in the current period (weekly/monthly). */
export function goalDueLabel(goal: GoalRow): string {
  const t = trimNum(goal.period_target);
  const u = goal.unit ? ` ${goal.unit}` : "";
  if (goal.tracking_type === "boolean") {
    return goal.frequency === "daily" ? "Complete today" :
      goal.frequency === "weekly" ? "Complete this week" : "Complete this month";
  }
  const per = goal.frequency === "daily" ? "today" :
    goal.frequency === "weekly" ? "this week" : "this month";
  return `${t}${u} ${per}`;
}

export function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function min(a: string, b: string) { return a < b ? a : b; }
function max(a: string, b: string) { return a > b ? a : b; }
function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo, 1));
  return d.toISOString().slice(0, 7);
}
function round1(n: number) { return Math.round(n * 10) / 10; }
