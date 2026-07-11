// The Companion: gentle, rule-based encouragement drawn from your own data.
// It never generates doctrine — it points back to Scripture and your own record.

import type {
  DailyReflection,
  Goal,
  Habit,
  HabitLog,
  MemoryVerse,
  PrayerEntry,
  BibleProgress,
  Workout,
} from "./types";
import { bibleStats, todaysReading } from "./bible";
import { addDays, lastNDays, todayISO, weekStart } from "./dates";

export interface Nudge {
  kind: "encourage" | "act" | "celebrate";
  text: string;
  href?: string;
}

export function buildNudges(input: {
  progress: BibleProgress;
  workouts: Workout[];
  habits: Habit[];
  habitLog: HabitLog;
  memory: MemoryVerse[];
  prayers: PrayerEntry[];
  goals: Goal[];
}): Nudge[] {
  const today = todayISO();
  const nudges: Nudge[] = [];
  const stats = bibleStats(input.progress);
  const reading = todaysReading(input.progress);

  if (stats.streak >= 7) {
    nudges.push({ kind: "celebrate", text: `A ${stats.streak}-day reading streak — steady faithfulness is quiet strength.` });
  }
  if (reading.length > 0 && stats.recentPace < stats.paceNeeded * 0.7 && stats.completed > 0) {
    nudges.push({
      kind: "encourage",
      text: `Your recent pace is behind the plan. The plan has already adjusted — today's portion is ${reading.length} chapters. One faithful day is all it asks.`,
      href: "/bible",
    });
  }
  if (stats.completed === 0) {
    nudges.push({ kind: "act", text: "Begin your Bible plan today — Matthew 1 is waiting.", href: "/bible" });
  }

  const ws = weekStart(today);
  const workoutsThisWeek = input.workouts.filter((w) => w.date >= ws && w.date <= today).length;
  if (workoutsThisWeek >= 4) {
    nudges.push({ kind: "celebrate", text: `Workout goal met this week (${workoutsThisWeek} of 4). Your discipline is bearing fruit.` });
  } else {
    const daysLeft = 7 - ((new Date().getDay() + 6) % 7);
    if (4 - workoutsThisWeek >= daysLeft && daysLeft <= 3) {
      nudges.push({ kind: "act", text: `${4 - workoutsThisWeek} workouts still needed with ${daysLeft} days left this week.`, href: "/workouts" });
    }
  }

  const due = input.memory.filter((v) => !v.memorized && v.nextReview <= today).length;
  if (due > 0) {
    nudges.push({ kind: "act", text: `${due} memory ${due === 1 ? "verse is" : "verses are"} due for review.`, href: "/memory" });
  }

  const openPrayers = input.prayers.filter((p) => p.kind === "request" && !p.answered);
  const old = openPrayers.filter((p) => p.createdAt.slice(0, 10) <= addDays(today, -30));
  if (old.length > 0) {
    nudges.push({
      kind: "encourage",
      text: `You have been carrying ${old.length} prayer ${old.length === 1 ? "request" : "requests"} for over a month. Revisit them — some may already be answered.`,
      href: "/prayer",
    });
  }

  const soon = input.goals.filter((g) => g.status !== "completed" && g.targetDate && g.targetDate >= today && g.targetDate <= addDays(today, 7));
  if (soon.length > 0) {
    nudges.push({ kind: "act", text: `${soon.length} goal ${soon.length === 1 ? "deadline" : "deadlines"} within a week.`, href: "/goals" });
  }

  return nudges.slice(0, 4);
}

const STOPWORDS = new Set(
  "the and for that this with have from was were will been being your what when they them then than there here just really very much more so not but had has can could would should about into over under again also i im me my we our you a an it its of on in to at as is are be do did dont".split(" ")
);

/** Recurring themes across recent daily reflections (simple word frequency). */
export function recurringThemes(reflections: DailyReflection[], limit = 6): string[] {
  const freq = new Map<string, number>();
  for (const r of reflections) {
    const text = `${r.wins} ${r.challenges} ${r.gratitude} ${r.lessons}`.toLowerCase();
    for (const word of text.match(/[a-z']{4,}/g) || []) {
      if (STOPWORDS.has(word)) continue;
      freq.set(word, (freq.get(word) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

/** Habit consistency over the last 30 days, as a fraction. */
export function habitConsistency(habits: Habit[], log: HabitLog, days = 30): number {
  const active = habits.filter((h) => !h.archived);
  if (active.length === 0) return 0;
  const range = lastNDays(days);
  let done = 0;
  for (const h of active) for (const d of range) if (log[h.id]?.[d]) done++;
  return done / (active.length * days);
}
