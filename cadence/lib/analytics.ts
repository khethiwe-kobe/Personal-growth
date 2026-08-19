import type { TaskRow, TimeBlockRow, FocusSessionRow } from "./types";

/**
 * Daily analytics — pure functions so every number in the UI has one source
 * of truth and can be unit-tested.
 *
 * The productivity score is deliberately transparent:
 *
 *   score = 45% × task completion
 *         + 25% × time follow-through (completed planned minutes / planned minutes)
 *         + 30% × goals-due-today completion
 *
 * A component with no data that day is removed and the remaining weights are
 * re-normalised (planning nothing isn't scored as failing — it's just a rest
 * day unless tasks/goals existed). The full breakdown is returned so the UI
 * can show exactly how the number was produced.
 */

// Hours between these bounds are expected to be accounted for.
// Sleep outside the window is nobody's business.
export const ACCOUNT_START = 6 * 60;   // 06:00
export const ACCOUNT_END = 22 * 60;    // 22:00

export type ScorePart = {
  key: "tasks" | "time" | "goals";
  label: string;
  weight: number;      // normalised weight actually used
  raw: number;         // 0..1 component value
  detail: string;
};

export type DaySummary = {
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  completionPct: number;          // tasks
  plannedMinutes: number;
  completedMinutes: number;       // planned minutes of completed tasks
  byPriority: Record<"A" | "B" | "C", { planned: number; completed: number }>;
  byCategory: { categoryId: number | null; plannedMin: number; completedMin: number }[];
  overdueTasks: number;
  lateCompletions: number;
  allocatedMinutes: number;       // scheduled tasks + intentional blocks in window
  unaccountedMinutes: number;     // window minus allocation
  productiveMinutes: number;      // completed planned task minutes
  focusMinutes: number;
  focusSessions: number;
  focusCompleted: number;
  focusInterrupted: number;
  goalsDue: number;
  goalsCompleted: number;
  score: number;                  // 0..100
  scoreParts: ScorePart[];
};

export type Interval = { start: number; end: number };

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .slice()
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** Gaps within [ACCOUNT_START, ACCOUNT_END] not covered by any interval. */
export function unaccountedGaps(intervals: Interval[]): Interval[] {
  const merged = mergeIntervals(
    intervals.map((i) => ({
      start: Math.max(i.start, ACCOUNT_START),
      end: Math.min(i.end, ACCOUNT_END),
    }))
  );
  const gaps: Interval[] = [];
  let cursor = ACCOUNT_START;
  for (const m of merged) {
    if (m.start > cursor) gaps.push({ start: cursor, end: m.start });
    cursor = Math.max(cursor, m.end);
  }
  if (cursor < ACCOUNT_END) gaps.push({ start: cursor, end: ACCOUNT_END });
  return gaps;
}

export function computeDaySummary(opts: {
  date: string;
  tasks: TaskRow[];
  blocks: TimeBlockRow[];
  focus: FocusSessionRow[];
  goalsDue: number;
  goalsCompleted: number;
  /** current minutes-from-midnight if `date` is today in the user's tz, else null */
  nowMin: number | null;
}): DaySummary {
  const { date, tasks, blocks, focus, goalsDue, goalsCompleted, nowMin } = opts;

  const tasksPlanned = tasks.length;
  const done = tasks.filter((t) => t.completed);
  const tasksCompleted = done.length;
  const completionPct = tasksPlanned
    ? Math.round((tasksCompleted / tasksPlanned) * 100)
    : 0;

  const plannedMinutes = tasks.reduce((s, t) => s + effMinutes(t), 0);
  const completedMinutes = done.reduce((s, t) => s + effMinutes(t), 0);

  const byPriority: DaySummary["byPriority"] = {
    A: { planned: 0, completed: 0 },
    B: { planned: 0, completed: 0 },
    C: { planned: 0, completed: 0 },
  };
  for (const t of tasks) {
    const p = byPriority[t.priority] ?? byPriority.B;
    p.planned++;
    if (t.completed) p.completed++;
  }

  const catMap = new Map<number | null, { plannedMin: number; completedMin: number }>();
  for (const t of tasks) {
    const key = t.category_id;
    const entry = catMap.get(key) ?? { plannedMin: 0, completedMin: 0 };
    entry.plannedMin += effMinutes(t);
    if (t.completed) entry.completedMin += effMinutes(t);
    catMap.set(key, entry);
  }
  const byCategory = [...catMap.entries()]
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .sort((a, b) => b.plannedMin - a.plannedMin);

  // Overdue: not completed and its scheduled end (or the whole day) has passed.
  let overdueTasks = 0;
  for (const t of tasks) {
    if (t.completed) continue;
    if (nowMin === null) overdueTasks++; // a past day: everything unfinished is overdue
    else if (t.end_min !== null && t.end_min < nowMin) overdueTasks++;
  }
  const lateCompletions = tasks.filter(
    (t) => t.completed && t.completed_at && t.completed_at.slice(0, 10) > t.date
  ).length;

  // Time accounting: scheduled tasks + intentional blocks cover the window.
  const intervals: Interval[] = [];
  for (const t of tasks)
    if (t.start_min !== null && t.end_min !== null)
      intervals.push({ start: t.start_min, end: t.end_min });
  for (const b of blocks) intervals.push({ start: b.start_min, end: b.end_min });
  const gaps = unaccountedGaps(intervals);
  // For today, only gaps that have already begun count against you.
  const effectiveGaps =
    nowMin === null
      ? gaps
      : gaps
          .map((g) => ({ start: g.start, end: Math.min(g.end, Math.max(nowMin, ACCOUNT_START)) }))
          .filter((g) => g.end > g.start);
  const unaccountedMinutes = effectiveGaps.reduce((s, g) => s + (g.end - g.start), 0);
  const windowLen = ACCOUNT_END - ACCOUNT_START;
  const allocatedMinutes =
    windowLen - gaps.reduce((s, g) => s + (g.end - g.start), 0);

  const focusFinished = focus.filter((f) => f.status !== "active");
  const focusMinutes = Math.round(
    focusFinished.reduce((s, f) => s + f.focus_seconds, 0) / 60
  );

  // Score with transparent, re-normalised parts.
  const parts: ScorePart[] = [];
  if (tasksPlanned > 0)
    parts.push({
      key: "tasks", label: "Tasks completed", weight: 0.45,
      raw: tasksCompleted / tasksPlanned,
      detail: `${tasksCompleted} of ${tasksPlanned} tasks`,
    });
  if (plannedMinutes > 0)
    parts.push({
      key: "time", label: "Planned time completed", weight: 0.25,
      raw: Math.min(1, completedMinutes / plannedMinutes),
      detail: `${Math.round(completedMinutes)} of ${Math.round(plannedMinutes)} planned minutes`,
    });
  if (goalsDue > 0)
    parts.push({
      key: "goals", label: "Daily goals", weight: 0.3,
      raw: goalsCompleted / goalsDue,
      detail: `${goalsCompleted} of ${goalsDue} goals due today`,
    });
  const totalW = parts.reduce((s, p) => s + p.weight, 0);
  const score = totalW
    ? Math.round(parts.reduce((s, p) => s + (p.weight / totalW) * p.raw, 0) * 100)
    : 0;
  const scoreParts = parts.map((p) => ({ ...p, weight: totalW ? p.weight / totalW : 0 }));

  return {
    date, tasksPlanned, tasksCompleted, completionPct,
    plannedMinutes, completedMinutes, byPriority, byCategory,
    overdueTasks, lateCompletions,
    allocatedMinutes, unaccountedMinutes,
    productiveMinutes: completedMinutes, focusMinutes,
    focusSessions: focusFinished.length,
    focusCompleted: focusFinished.filter((f) => f.status === "completed").length,
    focusInterrupted: focusFinished.filter((f) => f.status === "interrupted").length,
    goalsDue, goalsCompleted, score, scoreParts,
  };
}

/** A task's minutes: explicit schedule wins over the estimate. */
function effMinutes(t: TaskRow): number {
  if (t.start_min !== null && t.end_min !== null && t.end_min > t.start_min)
    return t.end_min - t.start_min;
  return t.planned_minutes;
}

export function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/** Planning streak: consecutive days (ending today or yesterday) with a
 *  "productive day" — score ≥ 60 on a day where something was planned. */
export function productiveDayStreak(
  summaries: { date: string; score: number; tasksPlanned: number; goalsDue: number }[],
  today: string
): number {
  const byDate = new Map(summaries.map((s) => [s.date, s]));
  let streak = 0;
  let d = today;
  const t = byDate.get(today);
  const todayCounts = t && (t.tasksPlanned > 0 || t.goalsDue > 0) && t.score >= 60;
  if (!todayCounts) d = prevDay(today); // today in progress doesn't break it
  else { streak++; d = prevDay(d); }
  for (;;) {
    const s = byDate.get(d);
    if (s && (s.tasksPlanned > 0 || s.goalsDue > 0) && s.score >= 60) {
      streak++;
      d = prevDay(d);
    } else break;
  }
  return streak;
}

function prevDay(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
