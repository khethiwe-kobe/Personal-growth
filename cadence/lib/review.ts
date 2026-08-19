import { all, get } from "./db";
import { sharedMonth, summariesForRange, getUserTz, allGoalStats, categoriesFor } from "./repo";
import { monthDates, monthOf, todayInTz, fmtMonth, addMonths, fmtMinutes } from "./time";

/** Sections every review covers. Section 1 adapts to student vs working. */
export const REVIEW_SECTIONS = (role: string) => [
  {
    key: role === "working" ? "work" : "academic",
    title: role === "working" ? "Work" : "Academic",
    prompts: role === "working"
      ? ["Work performance", "Projects completed", "Professional development", "Productivity", "Career progress"]
      : ["Academic performance", "Study consistency", "Assignments & tests", "Productivity", "Attendance & commitment"],
  },
  { key: "structure", title: "Structure", prompts: ["Routine", "Time management", "Planning", "Discipline", "Consistency"] },
  { key: "spiritual", title: "Spiritual", prompts: ["Bible reading", "Prayer", "Church involvement", "Spiritual growth", "Personal disciplines"] },
  { key: "social", title: "Social", prompts: ["Friendships", "Family", "Community", "Quality time", "Healthy relationships"] },
  { key: "financial", title: "Financial", prompts: ["Budgeting", "Saving", "Spending", "Financial goals", "Giving"] },
  { key: "physical", title: "Physical", prompts: ["Exercise", "Sleep", "Nutrition", "General wellbeing"] },
];

export const REFLECTIONS: { key: string; q: string }[] = [
  { key: "went_well", q: "What went well this month?" },
  { key: "not_well", q: "What didn't go well?" },
  { key: "procrastinated", q: "What did you procrastinate on?" },
  { key: "distraction", q: "What was your biggest distraction?" },
  { key: "most_progress", q: "Which goal did you make the most progress on?" },
  { key: "neglected", q: "Which goal did you neglect?" },
  { key: "stop", q: "What habit should you stop?" },
  { key: "start", q: "What habit should you start?" },
  { key: "continue", q: "What should you continue?" },
  { key: "priority", q: "What is your biggest priority for next month?" },
];

export const YES_NO: { key: string; q: string }[] = [
  { key: "planned_most_days", q: "Did you plan your day most days?" },
  { key: "kept_minimums", q: "Did you keep your minimum standards even on bad days?" },
  { key: "on_track", q: "Are you on track for your bigger goals?" },
];

export type MonthMetrics = {
  month: string;
  avgScore: number;
  avgCompletion: number;
  goalCompletion: number;
  focusMinutes: number;
  daysPlanned: number;
  plannedMinutes: number;
  completedMinutes: number;
  bestDays: { date: string; score: number }[];
  worstDays: { date: string; score: number }[];
  unaccountedAvg: number;
  interrupted: number;
  focusCompleted: number;
};

export async function monthMetrics(userId: number, month: string): Promise<MonthMetrics> {
  const tz = await getUserTz(userId);
  const today = todayInTz(tz);
  const dates = monthDates(month).filter((d) => d <= today);
  const [sums, shared] = await Promise.all([
    dates.length
      ? summariesForRange(userId, dates[0], dates[dates.length - 1], tz)
      : Promise.resolve([]),
    sharedMonth(userId, month),
  ]);
  const active = sums.filter((s) => s.tasksPlanned > 0 || s.goalsDue > 0);
  const sorted = [...active].sort((a, b) => b.score - a.score);
  return {
    month,
    avgScore: shared.avgScore,
    avgCompletion: shared.avgCompletion,
    goalCompletion: shared.goalCompletion,
    focusMinutes: shared.focusMinutes,
    daysPlanned: active.length,
    plannedMinutes: sums.reduce((s, x) => s + x.plannedMinutes, 0),
    completedMinutes: sums.reduce((s, x) => s + x.completedMinutes, 0),
    bestDays: sorted.slice(0, 3).map((s) => ({ date: s.date, score: s.score })),
    worstDays: sorted.slice(-3).reverse().map((s) => ({ date: s.date, score: s.score })),
    unaccountedAvg: active.length
      ? Math.round(active.reduce((s, x) => s + x.unaccountedMinutes, 0) / active.length)
      : 0,
    interrupted: sums.reduce((s, x) => s + x.focusInterrupted, 0),
    focusCompleted: sums.reduce((s, x) => s + x.focusCompleted, 0),
  };
}

/** Data-driven insight sentences comparing this month with the previous one. */
export function monthInsights(cur: MonthMetrics, prev: MonthMetrics): string[] {
  const out: string[] = [];
  const pm = fmtMonth(prev.month).split(" ")[0];
  if (prev.daysPlanned === 0) {
    out.push(`No data for ${pm} to compare against yet — this month sets the baseline.`);
    return out;
  }
  if (prev.avgScore > 0) {
    const d = cur.avgScore - prev.avgScore;
    if (Math.abs(d) >= 2)
      out.push(`Productivity ${d > 0 ? "increased" : "decreased"} ${Math.abs(Math.round((d / prev.avgScore) * 100))}% compared with ${pm}.`);
  }
  if (prev.goalCompletion > 0 && Math.abs(cur.goalCompletion - prev.goalCompletion) >= 3)
    out.push(`Goal consistency ${cur.goalCompletion > prev.goalCompletion ? "rose" : "fell"} from ${prev.goalCompletion}% to ${cur.goalCompletion}%.`);
  const weeksCur = Math.max(cur.daysPlanned / 7, 0.5);
  const weeksPrev = Math.max(prev.daysPlanned / 7, 0.5);
  const dPlan = cur.plannedMinutes / weeksCur - prev.plannedMinutes / weeksPrev;
  if (Math.abs(dPlan) >= 60)
    out.push(`Average planned time ${dPlan > 0 ? "increased" : "decreased"} by ${fmtMinutes(Math.abs(Math.round(dPlan)))} per week.`);
  const dFocus = cur.focusMinutes - prev.focusMinutes;
  if (Math.abs(dFocus) >= 60)
    out.push(`Focus time ${dFocus > 0 ? "up" : "down"} ${fmtMinutes(Math.abs(dFocus))} versus ${pm}.`);
  if (cur.unaccountedAvg && prev.unaccountedAvg &&
      Math.abs(cur.unaccountedAvg - prev.unaccountedAvg) >= 20)
    out.push(`Unaccounted time per planned day ${cur.unaccountedAvg < prev.unaccountedAvg ? "improved" : "grew"} from ${fmtMinutes(prev.unaccountedAvg)} to ${fmtMinutes(cur.unaccountedAvg)}.`);
  if (out.length === 0) out.push(`Broadly steady compared with ${pm}.`);
  return out;
}

export function getReview(userId: number, month: string) {
  return get<{ id: number; month: string; answers_json: string; submitted_at: string | null }>(
    "SELECT * FROM monthly_reviews WHERE user_id=? AND month=?",
    [userId, month]
  );
}

export async function reviewMonthsFor(userId: number): Promise<string[]> {
  const tz = await getUserTz(userId);
  const today = todayInTz(tz);
  const current = monthOf(today);
  const withReviews = (
    await all<{ month: string }>(
      "SELECT month FROM monthly_reviews WHERE user_id=? ORDER BY month DESC",
      [userId]
    )
  ).map((r) => r.month);
  const set = new Set([current, addMonths(current, -1), ...withReviews]);
  return [...set].sort().reverse();
}
