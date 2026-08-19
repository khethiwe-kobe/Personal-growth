import { all, get } from "./db";
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

export async function getUserTz(userId: number): Promise<string> {
  const row = await get<{ timezone: string }>(
    "SELECT timezone FROM users WHERE id=?", [userId]
  );
  return row?.timezone ?? "Africa/Johannesburg";
}

export function tasksForDay(userId: number, date: string): Promise<TaskRow[]> {
  return all<TaskRow>(
    `SELECT * FROM tasks WHERE user_id=? AND date=?
     ORDER BY (start_min IS NULL), start_min, priority, id`,
    [userId, date]
  );
}

export function blocksForDay(userId: number, date: string): Promise<TimeBlockRow[]> {
  return all<TimeBlockRow>(
    "SELECT * FROM time_blocks WHERE user_id=? AND date=? ORDER BY start_min",
    [userId, date]
  );
}

export function focusForDay(userId: number, date: string): Promise<FocusSessionRow[]> {
  return all<FocusSessionRow>(
    "SELECT * FROM focus_sessions WHERE user_id=? AND date=? ORDER BY started_at",
    [userId, date]
  );
}

export function categoriesFor(userId: number): Promise<CategoryRow[]> {
  return all<CategoryRow>(
    "SELECT * FROM categories WHERE user_id=? AND archived=0 ORDER BY position, id",
    [userId]
  );
}

export function goalsFor(userId: number, includeArchived = false): Promise<GoalRow[]> {
  const where = includeArchived ? "" : "AND status != 'archived'";
  return all<GoalRow>(
    `SELECT * FROM goals WHERE user_id=? ${where} ORDER BY status='active' DESC, id`,
    [userId]
  );
}

export function checkinsFor(goalId: number): Promise<CheckinRow[]> {
  return all<CheckinRow>(
    "SELECT * FROM goal_checkins WHERE goal_id=? ORDER BY date", [goalId]
  );
}

/** All check-ins for a user, grouped by goal — one query instead of N. */
async function checkinsByGoal(userId: number): Promise<Map<number, CheckinRow[]>> {
  const rows = await all<CheckinRow>(
    "SELECT * FROM goal_checkins WHERE user_id=? ORDER BY goal_id, date", [userId]
  );
  const map = new Map<number, CheckinRow[]>();
  for (const r of rows) {
    const arr = map.get(r.goal_id);
    if (arr) arr.push(r);
    else map.set(r.goal_id, [r]);
  }
  return map;
}

export async function goalWithStats(goal: GoalRow, today: string) {
  return { goal, stats: computeGoalStats(goal, await checkinsFor(goal.id), today) };
}

export async function allGoalStats(
  userId: number, today: string, includeArchived = false
): Promise<{ goal: GoalRow; stats: GoalStats }[]> {
  const [goals, checkins] = await Promise.all([
    goalsFor(userId, includeArchived),
    checkinsByGoal(userId),
  ]);
  return goals.map((goal) => ({
    goal,
    stats: computeGoalStats(goal, checkins.get(goal.id) ?? [], today),
  }));
}

/** Count of daily goals due today + how many were completed. */
export async function goalsDueToday(userId: number, today: string) {
  const items = (await allGoalStats(userId, today)).filter(
    (g) => g.stats.todayTarget !== null
  );
  return {
    due: items.length,
    completed: items.filter((g) => g.stats.todayValue >= (g.stats.todayTarget as number)).length,
    items,
  };
}

export async function daySummaryFor(
  userId: number, date: string, tz: string
): Promise<DaySummary> {
  const today = todayInTz(tz);
  const [tasks, blocks, focus, g] = await Promise.all([
    tasksForDay(userId, date),
    blocksForDay(userId, date),
    focusForDay(userId, date),
    goalsDueForDate(userId, date, today),
  ]);
  return computeDaySummary({
    date, tasks, blocks, focus,
    goalsDue: g.due,
    goalsCompleted: g.completed,
    nowMin: date === today ? nowMinutesInTz(tz) : date > today ? 0 : null,
  });
}

/** Goals that were due on an arbitrary (possibly past) date. */
async function goalsDueForDate(userId: number, date: string, today: string) {
  const items = await allGoalStats(userId, today, true);
  let due = 0, completed = 0;
  for (const { goal, stats } of items) {
    if (goal.frequency !== "daily") continue;
    if (goal.status === "archived") continue;
    const p = stats.periods.find((pp) => pp.key === date);
    if (!p) continue;
    due++;
    if (p.value >= goal.period_target) completed++;
  }
  return { due, completed };
}

/**
 * Day summaries for a date range. Loads each table once for the whole range
 * rather than per day — important now that every query is a network round trip.
 */
export async function summariesForRange(
  userId: number, start: string, end: string, tz: string
): Promise<DaySummary[]> {
  const today = todayInTz(tz);
  const [tasks, blocks, focus, goalItems] = await Promise.all([
    all<TaskRow>(
      "SELECT * FROM tasks WHERE user_id=? AND date>=? AND date<=?", [userId, start, end]
    ),
    all<TimeBlockRow>(
      "SELECT * FROM time_blocks WHERE user_id=? AND date>=? AND date<=?", [userId, start, end]
    ),
    all<FocusSessionRow>(
      "SELECT * FROM focus_sessions WHERE user_id=? AND date>=? AND date<=?", [userId, start, end]
    ),
    allGoalStats(userId, today, true),
  ]);

  const byDate = <T extends { date: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const arr = m.get(r.date);
      if (arr) arr.push(r);
      else m.set(r.date, [r]);
    }
    return m;
  };
  const t = byDate(tasks), b = byDate(blocks), f = byDate(focus);

  // Daily-goal due/complete counts per date, from already-computed periods.
  const goalDue = new Map<string, { due: number; completed: number }>();
  for (const { goal, stats } of goalItems) {
    if (goal.frequency !== "daily" || goal.status === "archived") continue;
    for (const p of stats.periods) {
      if (p.key < start || p.key > end) continue;
      const e = goalDue.get(p.key) ?? { due: 0, completed: 0 };
      e.due++;
      if (p.value >= goal.period_target) e.completed++;
      goalDue.set(p.key, e);
    }
  }

  return rangeDates(start, end).map((date) => {
    const g = goalDue.get(date) ?? { due: 0, completed: 0 };
    return computeDaySummary({
      date,
      tasks: t.get(date) ?? [],
      blocks: b.get(date) ?? [],
      focus: f.get(date) ?? [],
      goalsDue: g.due,
      goalsCompleted: g.completed,
      nowMin: date === today ? nowMinutesInTz(tz) : date > today ? 0 : null,
    });
  });
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

export async function sharedToday(userId: number): Promise<SharedToday> {
  const tz = await getUserTz(userId);
  const today = todayInTz(tz);
  const past = await summariesForRange(userId, addDays(today, -30), today, tz);
  const s = past[past.length - 1];
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
export async function sharedGoals(userId: number): Promise<SharedGoal[]> {
  const tz = await getUserTz(userId);
  const today = todayInTz(tz);
  const [items, cats] = await Promise.all([
    allGoalStats(userId, today),
    categoriesFor(userId),
  ]);
  const catMap = new Map(cats.map((c) => [c.id, c]));
  return items
    .filter(({ goal }) => goal.share_progress && goal.status !== "archived")
    .map(({ goal, stats }) => {
      const cat = goal.category_id ? catMap.get(goal.category_id) : undefined;
      return {
        goalId: goal.id,
        title: goal.title,
        categoryName: cat?.name ?? "General",
        categoryColor: cat?.color ?? "#b8b8b0",
        overallPct: stats.overallPct,
        consistencyPct: stats.consistencyPct,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        weekValue: Math.round(stats.weekValue * 10) / 10,
        weekTarget: stats.weekTarget,
        frequency: goal.frequency,
        periodTarget: goal.period_target,
        unit: goal.unit,
        trackingType: goal.tracking_type,
        status: goal.status,
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

export async function sharedWeek(userId: number, weekStart?: string): Promise<SharedWeek> {
  const tz = await getUserTz(userId);
  const today = todayInTz(tz);
  const ws = weekStart ?? startOfWeek(today);
  const we = addDays(ws, 6);
  const end = we < today ? we : today;
  const [sums, goals] = await Promise.all([
    summariesForRange(userId, ws, end, tz),
    allGoalStats(userId, today),
  ]);
  const active = sums.filter((s) => s.tasksPlanned > 0 || s.goalsDue > 0);
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

export async function sharedMonth(userId: number, month?: string): Promise<SharedMonth> {
  const tz = await getUserTz(userId);
  const today = todayInTz(tz);
  const m = month ?? monthOf(today);
  const dates = monthDates(m).filter((d) => d <= today);
  const [sums, goals, review] = await Promise.all([
    dates.length
      ? summariesForRange(userId, dates[0], dates[dates.length - 1], tz)
      : Promise.resolve([]),
    allGoalStats(userId, today),
    get<{ submitted_at: string | null }>(
      "SELECT submitted_at FROM monthly_reviews WHERE user_id=? AND month=?", [userId, m]
    ),
  ]);
  const active = sums.filter((s) => s.tasksPlanned > 0 || s.goalsDue > 0);
  let due = 0, done = 0;
  for (const g of goals)
    for (const p of g.stats.periods)
      if (monthOf(p.start) === m && !p.inProgress) {
        due++;
        if (p.complete) done++;
      }
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

export function eventsFor(userId: number, from: string, to: string): Promise<EventRow[]> {
  return all<EventRow>(
    "SELECT * FROM calendar_events WHERE user_id=? AND date>=? AND date<=? ORDER BY date, start_min",
    [userId, from, to]
  );
}

export function countdownEvents(userId: number, today: string): Promise<EventRow[]> {
  return all<EventRow>(
    `SELECT * FROM calendar_events
      WHERE user_id=? AND countdown_slot IS NOT NULL AND date >= ?
      ORDER BY countdown_slot`,
    [userId, today]
  );
}

export function upcomingEvents(userId: number, today: string, limit = 6): Promise<EventRow[]> {
  return all<EventRow>(
    "SELECT * FROM calendar_events WHERE user_id=? AND date>=? ORDER BY date, start_min LIMIT ?",
    [userId, today, limit]
  );
}

export function timetableFor(userId: number): Promise<TimetableEntryRow[]> {
  return all<TimetableEntryRow>(
    "SELECT * FROM timetable_entries WHERE user_id=? ORDER BY day_of_week, start_min",
    [userId]
  );
}

function avgNum(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
