import { getDb } from "./db";
import { computeDaySummary, productiveDayStreak, type DaySummary } from "./analytics";
import { computeGoalStats, type GoalStats } from "./goals";
import { todayInTz, addDays, startOfWeek, monthOf, monthDates, rangeDates } from "./time";
import type {
  TaskRow, TimeBlockRow, FocusSessionRow, GoalRow, CheckinRow,
  CategoryRow, EventRow, TimetableEntryRow,
} from "./types";

/**
 * Composed data access. Sharing rule: functions whose names start with
 * `shared` return ONLY aggregate numbers and are the only functions the UI
 * may call for another group member. Raw rows are owner-only.
 */

export function nowMinutesInTz(tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function getUserTz(userId: number): string {
  const row = getDb().prepare("SELECT timezone FROM users WHERE id=?").get(userId) as
    | { timezone: string } | undefined;
  return row?.timezone ?? "Africa/Johannesburg";
}

export function tasksForDay(userId: number, date: string): TaskRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM tasks WHERE user_id=? AND date=?
       ORDER BY (start_min IS NULL), start_min, priority, id`
    )
    .all(userId, date) as TaskRow[];
}

export function blocksForDay(userId: number, date: string): TimeBlockRow[] {
  return getDb()
    .prepare("SELECT * FROM time_blocks WHERE user_id=? AND date=? ORDER BY start_min")
    .all(userId, date) as TimeBlockRow[];
}

export function focusForDay(userId: number, date: string): FocusSessionRow[] {
  return getDb()
    .prepare("SELECT * FROM focus_sessions WHERE user_id=? AND date=? ORDER BY started_at")
    .all(userId, date) as FocusSessionRow[];
}

export function categoriesFor(userId: number): CategoryRow[] {
  return getDb()
    .prepare("SELECT * FROM categories WHERE user_id=? AND archived=0 ORDER BY position, id")
    .all(userId) as CategoryRow[];
}

export function goalsFor(userId: number, includeArchived = false): GoalRow[] {
  const where = includeArchived ? "" : "AND status != 'archived'";
  return getDb()
    .prepare(`SELECT * FROM goals WHERE user_id=? ${where} ORDER BY status='active' DESC, id`)
    .all(userId) as GoalRow[];
}

export function checkinsFor(goalId: number): CheckinRow[] {
  return getDb()
    .prepare("SELECT * FROM goal_checkins WHERE goal_id=? ORDER BY date")
    .all(goalId) as CheckinRow[];
}

export function goalWithStats(goal: GoalRow, today: string) {
  return { goal, stats: computeGoalStats(goal, checkinsFor(goal.id), today) };
}

export function allGoalStats(userId: number, today: string) {
  return goalsFor(userId).map((g) => goalWithStats(g, today));
}

/** Count of daily goals due today + how many were completed. */
export function goalsDueToday(userId: number, today: string) {
  const items = allGoalStats(userId, today).filter(
    (g) => g.stats.todayTarget !== null
  );
  return {
    due: items.length,
    completed: items.filter((g) => g.stats.todayValue >= (g.stats.todayTarget as number)).length,
    items,
  };
}

export function daySummaryFor(userId: number, date: string, tz: string): DaySummary {
  const today = todayInTz(tz);
  const g = goalsDueForDate(userId, date, today);
  return computeDaySummary({
    date,
    tasks: tasksForDay(userId, date),
    blocks: blocksForDay(userId, date),
    focus: focusForDay(userId, date),
    goalsDue: g.due,
    goalsCompleted: g.completed,
    nowMin: date === today ? nowMinutesInTz(tz) : date > today ? 0 : null,
  });
}

/** Goals that were due on an arbitrary (possibly past) date. */
function goalsDueForDate(userId: number, date: string, today: string) {
  const goals = goalsFor(userId, true);
  let due = 0, completed = 0;
  for (const goal of goals) {
    if (goal.frequency !== "daily") continue;
    if (goal.start_date > date) continue;
    if (goal.deadline && goal.deadline < date) continue;
    if (goal.status === "archived") continue;
    if (goal.status === "completed" && goal.completed_at && goal.completed_at.slice(0, 10) < date) continue;
    const stats = computeGoalStats(goal, checkinsFor(goal.id), today);
    const p = stats.periods.find((pp) => pp.key === date);
    if (!p) continue;
    due++;
    if (p.value >= goal.period_target) completed++;
  }
  return { due, completed };
}

export function summariesForRange(userId: number, start: string, end: string, tz: string) {
  return rangeDates(start, end).map((d) => daySummaryFor(userId, d, tz));
}

// ---------- Shared (aggregate-only) views ----------

export type SharedToday = {
  userId: number;
  date: string;
  score: number;
  tasksCompleted: number;
  tasksPlanned: number;
  plannedMinutes: number;
  completedMinutes: number;
  goalsDue: number;
  goalsCompleted: number;
  focusMinutes: number;
  productiveStreak: number;
};

export function sharedToday(userId: number): SharedToday {
  const tz = getUserTz(userId);
  const today = todayInTz(tz);
  const s = daySummaryFor(userId, today, tz);
  const past = summariesForRange(userId, addDays(today, -30), today, tz);
  return {
    userId, date: today, score: s.score,
    tasksCompleted: s.tasksCompleted, tasksPlanned: s.tasksPlanned,
    plannedMinutes: s.plannedMinutes, completedMinutes: s.completedMinutes,
    goalsDue: s.goalsDue, goalsCompleted: s.goalsCompleted,
    focusMinutes: s.focusMinutes,
    productiveStreak: productiveDayStreak(past, today),
  };
}

export type SharedGoal = {
  goalId: number;
  title: string;
  categoryName: string;
  categoryColor: string;
  overallPct: number;
  consistencyPct: number;
  currentStreak: number;
  longestStreak: number;
  weekValue: number;
  weekTarget: number;
  frequency: string;
  periodTarget: number;
  unit: string;
  trackingType: string;
  status: string;
};

/** Shared goal list: titles + numbers only. why/evidence/notes never leave. */
export function sharedGoals(userId: number): SharedGoal[] {
  const tz = getUserTz(userId);
  const today = todayInTz(tz);
  const cats = new Map(categoriesFor(userId).map((c) => [c.id, c]));
  return goalsFor(userId)
    .filter((g) => g.share_progress && g.status !== "archived")
    .map((g) => {
      const stats = computeGoalStats(g, checkinsFor(g.id), today);
      const cat = g.category_id ? cats.get(g.category_id) : undefined;
      return {
        goalId: g.id,
        title: g.title,
        categoryName: cat?.name ?? "General",
        categoryColor: cat?.color ?? "#b8b8b0",
        overallPct: stats.overallPct,
        consistencyPct: stats.consistencyPct,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        weekValue: Math.round(stats.weekValue * 10) / 10,
        weekTarget: stats.weekTarget,
        frequency: g.frequency,
        periodTarget: g.period_target,
        unit: g.unit,
        trackingType: g.tracking_type,
        status: g.status,
      };
    });
}

export type SharedWeek = {
  avgScore: number;
  avgCompletion: number;
  focusMinutes: number;
  goalConsistency: number; // % of goal-periods completed this week
  daysPlanned: number;
};

export function sharedWeek(userId: number, weekStart?: string): SharedWeek {
  const tz = getUserTz(userId);
  const today = todayInTz(tz);
  const ws = weekStart ?? startOfWeek(today);
  const we = addDays(ws, 6);
  const end = we < today ? we : today;
  const sums = summariesForRange(userId, ws, end, tz);
  const active = sums.filter((s) => s.tasksPlanned > 0 || s.goalsDue > 0);
  const goals = allGoalStats(userId, today);
  let due = 0, done = 0;
  for (const g of goals) {
    for (const p of g.stats.periods) {
      if (p.start >= ws && p.end <= we && !p.inProgress) {
        due++;
        if (p.complete) done++;
      }
    }
  }
  return {
    avgScore: Math.round(avgNum(active.map((s) => s.score))),
    avgCompletion: Math.round(avgNum(active.map((s) => s.completionPct))),
    focusMinutes: sums.reduce((s, x) => s + x.focusMinutes, 0),
    goalConsistency: due ? Math.round((done / due) * 100) : 0,
    daysPlanned: active.length,
  };
}

export type SharedMonth = {
  month: string;
  avgScore: number;
  avgCompletion: number;
  goalCompletion: number;
  focusMinutes: number;
  daysPlanned: number;
  reviewSubmitted: boolean;
};

export function sharedMonth(userId: number, month?: string): SharedMonth {
  const tz = getUserTz(userId);
  const today = todayInTz(tz);
  const m = month ?? monthOf(today);
  const dates = monthDates(m).filter((d) => d <= today);
  const sums = dates.length
    ? summariesForRange(userId, dates[0], dates[dates.length - 1], tz)
    : [];
  const active = sums.filter((s) => s.tasksPlanned > 0 || s.goalsDue > 0);
  const goals = allGoalStats(userId, today);
  let due = 0, done = 0;
  for (const g of goals)
    for (const p of g.stats.periods)
      if (monthOf(p.start) === m && !p.inProgress) {
        due++;
        if (p.complete) done++;
      }
  const review = getDb()
    .prepare("SELECT submitted_at FROM monthly_reviews WHERE user_id=? AND month=?")
    .get(userId, m) as { submitted_at: string | null } | undefined;
  return {
    month: m,
    avgScore: Math.round(avgNum(active.map((s) => s.score))),
    avgCompletion: Math.round(avgNum(active.map((s) => s.completionPct))),
    goalCompletion: due ? Math.round((done / due) * 100) : 0,
    focusMinutes: sums.reduce((s, x) => s + x.focusMinutes, 0),
    daysPlanned: active.length,
    reviewSubmitted: !!review?.submitted_at,
  };
}

// ---------- Calendar / timetable / events ----------

export function eventsFor(userId: number, from: string, to: string): EventRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM calendar_events WHERE user_id=? AND date>=? AND date<=? ORDER BY date, start_min"
    )
    .all(userId, from, to) as EventRow[];
}

export function countdownEvents(userId: number, today: string): EventRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM calendar_events
        WHERE user_id=? AND countdown_slot IS NOT NULL AND date >= ?
        ORDER BY countdown_slot`
    )
    .all(userId, today) as EventRow[];
}

export function upcomingEvents(userId: number, today: string, limit = 6): EventRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM calendar_events WHERE user_id=? AND date>=? ORDER BY date, start_min LIMIT ?"
    )
    .all(userId, today, limit) as EventRow[];
}

export function timetableFor(userId: number): TimetableEntryRow[] {
  return getDb()
    .prepare("SELECT * FROM timetable_entries WHERE user_id=? ORDER BY day_of_week, start_min")
    .all(userId) as TimetableEntryRow[];
}

function avgNum(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
