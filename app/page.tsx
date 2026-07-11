"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, Field, Input, ProgressBar, SectionTitle, Tag, Textarea } from "@/components/ui";
import { ProgressRing } from "@/components/viz";
import { useStore } from "@/lib/storage";
import type {
  AppSettings,
  BibleProgress,
  DailyReflection,
  Goal,
  Habit,
  HabitLog,
  MemoryVerse,
  PrayerEntry,
  TruthCard,
  Workout,
} from "@/lib/types";
import { bibleStats, todaysReading } from "@/lib/bible";
import { addDays, dayOfYear, formatLong, formatShort, streakFrom, todayISO, weekStart } from "@/lib/dates";
import { quotes } from "@/lib/data/quotes";
import { buildNudges } from "@/lib/companion";

const DEFAULT_SETTINGS: AppSettings = {
  name: "",
  reminders: { bible: true, workout: true, meals: true, weeklyReview: true, monthlyReview: true, goals: true },
  dailyFocus: {},
};

const EMPTY_REFLECTION = (date: string): DailyReflection => ({
  date,
  wins: "",
  challenges: "",
  gratitude: "",
  lessons: "",
  tomorrowFocus: "",
});

export default function Dashboard() {
  const today = todayISO();
  const [settings, setSettings] = useStore<AppSettings>("settings", DEFAULT_SETTINGS);
  const [progress] = useStore<BibleProgress>("bible", {});
  const [workouts] = useStore<Workout[]>("workouts", []);
  const [habits] = useStore<Habit[]>("habits", []);
  const [habitLog] = useStore<HabitLog>("habitLog", {});
  const [goals] = useStore<Goal[]>("goals", []);
  const [memory] = useStore<MemoryVerse[]>("memory", []);
  const [prayers] = useStore<PrayerEntry[]>("prayers", []);
  const [truthCards] = useStore<TruthCard[]>("truthCards", []);
  const [reflections, setReflections] = useStore<Record<string, DailyReflection>>("reflectDaily", {});

  const stats = useMemo(() => bibleStats(progress), [progress]);
  const reading = useMemo(() => todaysReading(progress), [progress]);

  const ws = weekStart(today);
  const workoutsThisWeek = workouts.filter((w) => w.date >= ws && w.date <= today).length;

  // Progress rings, one per life area
  const assignedDoneToday = stats.perDay[today] || 0;
  const spiritualRing =
    reading.length === 0 ? 1 : Math.min(1, assignedDoneToday / (assignedDoneToday + reading.length));
  const physicalRing = Math.min(1, workoutsThisWeek / 4);
  const activeHabits = habits.filter((h) => !h.archived);
  const habitsToday = activeHabits.filter((h) => habitLog[h.id]?.[today]).length;
  const mentalRing = activeHabits.length ? habitsToday / activeHabits.length : 0;
  const goalProgress = (g: Goal) =>
    g.status === "completed" ? 1 : g.milestones.length ? g.milestones.filter((m) => m.done).length / g.milestones.length : 0;
  const weeklyGoals = goals.filter((g) => g.horizon === "weekly" && g.status !== "on-hold");
  const monthlyGoals = goals.filter((g) => g.horizon === "monthly" && g.status !== "on-hold");
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const goalsRing = avg([...weeklyGoals, ...monthlyGoals].map(goalProgress));

  // Streaks
  const workoutStreakWeeks = useMemo(() => {
    let n = 0;
    let cursor = addDays(ws, -7);
    while (n < 260) {
      const count = workouts.filter((w) => w.date >= cursor && w.date < addDays(cursor, 7)).length;
      if (count >= 4) {
        n++;
        cursor = addDays(cursor, -7);
      } else break;
    }
    return n + (workoutsThisWeek >= 4 ? 1 : 0);
  }, [workouts, ws, workoutsThisWeek]);

  const habitDates = new Set<string>();
  for (const h of activeHabits) for (const [d, v] of Object.entries(habitLog[h.id] || {})) if (v) habitDates.add(d);
  const habitStreak = streakFrom(habitDates);

  const quote = quotes.length ? quotes[dayOfYear(today) % quotes.length] : null;
  const card = truthCards.length ? truthCards[dayOfYear(today) % truthCards.length] : null;

  const milestonesSoon = goals
    .filter((g) => g.status !== "completed" && g.targetDate >= today)
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))
    .slice(0, 4);

  const nudges = buildNudges({ progress, workouts, habits, habitLog, memory, prayers, goals });
  const reflection = reflections[today] || EMPTY_REFLECTION(today);
  const saveReflection = (patch: Partial<DailyReflection>) =>
    setReflections((prev) => ({ ...prev, [today]: { ...(prev[today] || EMPTY_REFLECTION(today)), ...patch } }));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="rise mb-8">
        <p className="text-sm text-faint">{formatLong(today)}</p>
        <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">
          {settings.name ? `Good day, ${settings.name}.` : "Good day."}
        </h1>
        {quote && (
          <blockquote className="mt-4 max-w-2xl border-l-2 border-beige-deep pl-4">
            <p className="font-display text-lg leading-relaxed text-soft">&ldquo;{quote.text}&rdquo;</p>
            <cite className="mt-1 block text-xs not-italic text-faint">{quote.author}</cite>
          </blockquote>
        )}
      </header>

      <Card className="mb-6">
        <Field label="Today's focus">
          <Input
            value={settings.dailyFocus[today] || ""}
            onChange={(e) => setSettings((s) => ({ ...s, dailyFocus: { ...s.dailyFocus, [today]: e.target.value } }))}
            placeholder="One thing that matters most today"
          />
        </Field>
      </Card>

      {card && (
        <Card className="mb-6 border-beige-deep bg-beige/50">
          <p className="text-xs font-medium uppercase tracking-wider text-faint">Truth for today</p>
          <p className="mt-2 font-display text-xl leading-relaxed text-ink">&ldquo;{card.text}&rdquo;</p>
          <p className="mt-1 text-sm text-brown">{card.ref}</p>
        </Card>
      )}

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <ProgressRing value={spiritualRing} label="Spiritual" sublabel="today's reading" />
          <ProgressRing value={physicalRing} label="Physical" sublabel={`${workoutsThisWeek} of 4 workouts`} />
          <ProgressRing value={mentalRing} label="Mind & habits" sublabel={`${habitsToday} of ${activeHabits.length} today`} />
          <ProgressRing value={goalsRing} label="Goals" sublabel="week & month" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle action={<Link href="/bible" className="text-xs text-brown hover:underline">Open plan</Link>}>
            Bible reading
          </SectionTitle>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-soft">Whole Bible</span>
            <span className="text-ink">{stats.pct}%</span>
          </div>
          <ProgressBar value={stats.pct} />
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-soft">
            <span>
              <span className="text-ink">{stats.completed}</span> chapters
            </span>
            <span>
              <span className="text-ink">{stats.streak}d</span> streak
            </span>
            <span>
              <span className="text-ink">{stats.daysRemaining}</span> days to {formatShort(stats.deadline)}
            </span>
            <span>
              today: <span className="text-ink">{reading.length === 0 ? "done" : `${reading.length} chapters`}</span>
            </span>
          </div>
          {reading.length > 0 && (
            <p className="mt-2 text-xs text-faint">
              Next: {reading.slice(0, 4).join(", ")}
              {reading.length > 4 ? "…" : ""}
            </p>
          )}
        </Card>

        <Card>
          <SectionTitle action={<Link href="/workouts" className="text-xs text-brown hover:underline">Open workouts</Link>}>
            This week&apos;s training
          </SectionTitle>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className={`h-3 flex-1 rounded-full ${i < workoutsThisWeek ? "bg-brown" : "bg-beige"}`} />
            ))}
          </div>
          <p className="mt-2 text-sm text-soft">
            <span className="text-ink">{workoutsThisWeek}</span> of 4 workouts · training streak{" "}
            <span className="text-ink">{workoutStreakWeeks}w</span> · habit streak <span className="text-ink">{habitStreak}d</span>
          </p>
          <div className="mt-4 space-y-3">
            {[
              { label: "Weekly goals", items: weeklyGoals },
              { label: "Monthly goals", items: monthlyGoals },
            ].map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-soft">{s.label}</span>
                  <span className="text-ink">
                    {s.items.length ? `${Math.round(avg(s.items.map(goalProgress)) * 100)}%` : "—"}
                  </span>
                </div>
                <ProgressBar value={avg(s.items.map(goalProgress)) * 100} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Companion</SectionTitle>
          {nudges.length === 0 ? (
            <p className="text-sm text-soft">All is well today. Walk it out one faithful step at a time.</p>
          ) : (
            <ul className="space-y-3">
              {nudges.map((n, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Tag tone={n.kind === "celebrate" ? "sage" : n.kind === "act" ? "brown" : "beige"}>
                    {n.kind === "celebrate" ? "well done" : n.kind === "act" ? "next step" : "gentle note"}
                  </Tag>
                  <p className="text-sm leading-relaxed text-soft">
                    {n.text}{" "}
                    {n.href && (
                      <Link href={n.href} className="text-brown hover:underline">
                        Go
                      </Link>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle action={<Link href="/goals" className="text-xs text-brown hover:underline">All goals</Link>}>
            Upcoming milestones
          </SectionTitle>
          {milestonesSoon.length === 0 ? (
            <p className="text-sm text-soft">No upcoming target dates. Set a goal to give the days direction.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {milestonesSoon.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-4 py-2">
                  <div>
                    <p className="text-sm text-ink">{g.title}</p>
                    <p className="text-xs capitalize text-faint">{g.horizon}</p>
                  </div>
                  <span className="text-xs text-soft">{formatShort(g.targetDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <SectionTitle action={<Link href="/reflection" className="text-xs text-brown hover:underline">All reflections</Link>}>
          Today&apos;s reflection
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wins">
            <Textarea rows={2} value={reflection.wins} onChange={(e) => saveReflection({ wins: e.target.value })} placeholder="What went well?" />
          </Field>
          <Field label="Gratitude">
            <Textarea rows={2} value={reflection.gratitude} onChange={(e) => saveReflection({ gratitude: e.target.value })} placeholder="What are you thankful for?" />
          </Field>
        </div>
      </Card>
    </div>
  );
}
