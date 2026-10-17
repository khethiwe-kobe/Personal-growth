import { beats, groupMetrics, improvementPct } from "./metrics";
import { addDays, weekStart } from "./time";
import type { Metric, Programme, WorkoutLog } from "./types";

/** Points are deliberately simple so everyone can see why they are where they are. */
export const POINTS = {
  completedSession: 10,
  partialSession: 5,
  maxSessionsPerDay: 2,
  photoDay: 3,
  baseline: 2,
  personalBest: 5,
} as const;

export type MemberProgress = {
  id: string;
  name: string;
  programme: Programme | null;
  logs: WorkoutLog[];
  metrics: Metric[];
  /** Days (YYYY-MM-DD) on which the member posted a progress photo. */
  photoDays: string[];
};

export type ScoreRow = {
  id: string;
  name: string;
  points: number;
  sessions: number;
  photos: number;
  bests: number;
  weekStreak: number;
  plannedPerWeek: number;
  thisWeekSessions: number;
  improvement: number | null;
  lastActive: string | null;
  rank: number;
};

export type Period = "week" | "all";

/** Training days per week in the member's programme (rest days excluded); 3 if none yet. */
export function plannedPerWeek(programme: Programme | null): number {
  if (!programme?.schedule?.length) return 3;
  const n = programme.schedule.filter((d) => d.duration_min > 0 && !/rest|off|recovery/i.test(d.session)).length;
  return Math.min(7, Math.max(1, n));
}

/** Completed sessions per week start (Monday). */
function sessionsByWeek(logs: WorkoutLog[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of logs) {
    if (!l.completed) continue;
    const w = weekStart(l.date);
    m.set(w, (m.get(w) ?? 0) + 1);
  }
  return m;
}

/**
 * Consecutive weeks in which the member did at least their planned number of
 * sessions. The current week counts once its target is met; until then the
 * streak is carried from previous weeks.
 */
export function weekStreak(logs: WorkoutLog[], planned: number, today: string): number {
  const byWeek = sessionsByWeek(logs);
  let w = weekStart(today);
  if ((byWeek.get(w) ?? 0) < planned) w = addDays(w, -7);
  let streak = 0;
  while ((byWeek.get(w) ?? 0) >= planned) {
    streak++;
    w = addDays(w, -7);
  }
  return streak;
}

/** Points earned from tracked tests: baselines and new personal bests. */
function metricEvents(metrics: Metric[]): { date: string; kind: "baseline" | "best" }[] {
  const out: { date: string; kind: "baseline" | "best" }[] = [];
  for (const readings of groupMetrics(metrics)) {
    let best = readings[0].value;
    out.push({ date: readings[0].date, kind: "baseline" });
    for (const r of readings.slice(1)) {
      if (beats(r, r.value, best)) {
        out.push({ date: r.date, kind: "best" });
        best = r.value;
      }
    }
  }
  return out;
}

export function scoreMember(m: MemberProgress, period: Period, today: string): Omit<ScoreRow, "rank"> {
  const from = period === "week" ? weekStart(today) : "0000-00-00";
  const inPeriod = (d: string) => d >= from && d <= today;

  let points = 0;
  let sessions = 0;
  const perDay = new Map<string, number>();
  for (const l of [...m.logs].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!inPeriod(l.date)) continue;
    const used = perDay.get(l.date) ?? 0;
    if (used >= POINTS.maxSessionsPerDay) continue;
    perDay.set(l.date, used + 1);
    points += l.completed ? POINTS.completedSession : POINTS.partialSession;
    if (l.completed) sessions++;
  }

  const photoDays = new Set(m.photoDays.filter(inPeriod));
  points += photoDays.size * POINTS.photoDay;

  let bests = 0;
  for (const e of metricEvents(m.metrics)) {
    if (!inPeriod(e.date)) continue;
    if (e.kind === "best") {
      bests++;
      points += POINTS.personalBest;
    } else points += POINTS.baseline;
  }

  const pcts = groupMetrics(m.metrics)
    .map(improvementPct)
    .filter((x): x is number => x !== null);
  const improvement = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;

  const planned = plannedPerWeek(m.programme);
  const activity = [...m.logs.map((l) => l.date), ...m.photoDays].filter((d) => d <= today).sort();

  return {
    id: m.id,
    name: m.name,
    points,
    sessions,
    photos: photoDays.size,
    bests,
    weekStreak: weekStreak(m.logs, planned, today),
    plannedPerWeek: planned,
    thisWeekSessions: sessionsByWeek(m.logs).get(weekStart(today)) ?? 0,
    improvement,
    lastActive: activity.length ? activity[activity.length - 1] : null,
  };
}

/** Ranked scoreboard: points, then completed sessions, then name. Ties share a rank. */
export function scoreboard(members: MemberProgress[], period: Period, today: string): ScoreRow[] {
  const rows = members
    .map((m) => scoreMember(m, period, today))
    .sort((a, b) => b.points - a.points || b.sessions - a.sessions || a.name.localeCompare(b.name));
  let rank = 0;
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    if (!prev || prev.points !== r.points || prev.sessions !== r.sessions) rank = i + 1;
    return { ...r, rank };
  });
}
