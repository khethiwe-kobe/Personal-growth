"use client";

import { useMemo } from "react";
import { Card, PageTitle, SectionTitle, Stat } from "@/components/ui";
import { BarChart, MonthHeatmap, ProgressRing } from "@/components/viz";
import { useStore } from "@/lib/storage";
import type { BibleProgress, Goal, Habit, HabitLog, Workout } from "@/lib/types";
import { MINUTES_PER_CHAPTER, bibleStats } from "@/lib/bible";
import { addDays, formatShort, lastNDays, monthKey, todayISO, weekStart } from "@/lib/dates";
import { habitConsistency } from "@/lib/companion";

export default function AnalyticsPage() {
  const today = todayISO();
  const [progress] = useStore<BibleProgress>("bible", {});
  const [workouts] = useStore<Workout[]>("workouts", []);
  const [habits] = useStore<Habit[]>("habits", []);
  const [habitLog] = useStore<HabitLog>("habitLog", {});
  const [goals] = useStore<Goal[]>("goals", []);

  const stats = useMemo(() => bibleStats(progress), [progress]);
  const ws = weekStart(today);

  // Reading per week, last 8 weeks
  const readingBars = useMemo(() => {
    const out = [];
    for (let i = 7; i >= 0; i--) {
      const start = addDays(ws, -7 * i);
      let n = 0;
      for (let d = start; d < addDays(start, 7); d = addDays(d, 1)) n += stats.perDay[d] || 0;
      out.push({ label: formatShort(start), value: n, hint: "chapters" });
    }
    return out;
  }, [stats.perDay, ws]);

  const workoutBars = useMemo(() => {
    const out = [];
    for (let i = 7; i >= 0; i--) {
      const start = addDays(ws, -7 * i);
      const n = workouts.filter((w) => w.date >= start && w.date < addDays(start, 7)).length;
      out.push({ label: formatShort(start), value: n, hint: "workouts" });
    }
    return out;
  }, [workouts, ws]);

  // Reading consistency: how many of the last 30 days had any reading
  const readingDays30 = lastNDays(30).filter((d) => (stats.perDay[d] || 0) > 0).length;

  const activeHabits = habits.filter((h) => !h.archived);
  const habitPct = habitConsistency(habits, habitLog);

  const goalsCompleted = goals.filter((g) => g.status === "completed").length;
  const goalPct = goals.length ? goalsCompleted / goals.length : 0;

  // Time invested (all time)
  const workoutMinutes = workouts.reduce((s, w) => s + (w.durationMin || 0), 0);
  const readingMinutes = stats.completed * MINUTES_PER_CHAPTER;

  // This month's activity heat map: reading chapters + workouts + habit completions
  const month = monthKey(today);
  const monthDays = useMemo(() => {
    const out: string[] = [];
    for (let d = month + "-01"; monthKey(d) === month; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);
  const monthCounts: Record<string, number> = {};
  for (const d of monthDays) {
    let n = (stats.perDay[d] || 0) > 0 ? 1 : 0;
    n += workouts.some((w) => w.date === d) ? 1 : 0;
    n += activeHabits.filter((h) => habitLog[h.id]?.[d]).length > 0 ? 1 : 0;
    monthCounts[d] = n;
  }

  const insights: string[] = [];
  if (stats.streak >= 3) insights.push(`You have read Scripture ${stats.streak} days in a row — your longest active streak right now.`);
  if (readingDays30 >= 20) insights.push(`You read on ${readingDays30} of the last 30 days. Consistency like this finishes Bibles.`);
  else if (readingDays30 > 0) insights.push(`You read on ${readingDays30} of the last 30 days. A fixed time of day usually doubles this.`);
  if (stats.recentPace >= stats.paceNeeded && stats.completed > 0) insights.push("Your recent reading pace is ahead of what the 30 November deadline requires.");
  const w4 = workoutBars.slice(-4).reduce((s, b) => s + b.value, 0);
  if (w4 >= 16) insights.push("Four straight weeks at four workouts or more — muscle is built exactly here.");
  else if (w4 > 0) insights.push(`${w4} workouts in the last four weeks. The weekly goal is 16 (4 per week).`);
  if (habitPct > 0.7) insights.push(`Habit completion is at ${Math.round(habitPct * 100)}% over 30 days — excellent.`);
  if (goals.length > 0) insights.push(`You have completed ${goalsCompleted} of ${goals.length} goals (${Math.round(goalPct * 100)}%).`);
  if (insights.length === 0) insights.push("Start logging reading, workouts and habits — insights will appear as your story accumulates.");

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Analytics" subtitle="Measure what matters, so grace-fueled effort has a map." />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <ProgressRing value={stats.completed / stats.total} label="Bible complete" sublabel={`${stats.completed} chapters`} />
          <ProgressRing value={readingDays30 / 30} label="Reading days" sublabel="last 30 days" />
          <ProgressRing value={habitPct} label="Habit completion" sublabel="last 30 days" />
          <ProgressRing value={goalPct} label="Goals completed" sublabel={`${goalsCompleted} of ${goals.length || 0}`} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Reading streak" value={`${stats.streak}d`} />
        <Stat label="Chapters this month" value={stats.thisMonth} />
        <Stat label="Time in training" value={`${Math.round(workoutMinutes / 60)}h`} hint="logged workout time" />
        <Stat label="Time in the Word" value={`${Math.round(readingMinutes / 60)}h`} hint={`~${MINUTES_PER_CHAPTER} min per chapter`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Chapters read per week</SectionTitle>
          <BarChart data={readingBars} />
        </Card>
        <Card>
          <SectionTitle>Workouts per week</SectionTitle>
          <BarChart data={workoutBars} />
        </Card>
        <Card>
          <SectionTitle>This month&apos;s activity</SectionTitle>
          <p className="mb-3 text-sm text-soft">Darker days combined reading, training and habits.</p>
          <MonthHeatmap days={monthDays} counts={monthCounts} max={3} />
        </Card>
        <Card>
          <SectionTitle>Growth insights</SectionTitle>
          <ul className="space-y-2.5">
            {insights.map((s, i) => (
              <li key={i} className="border-l-2 border-beige-deep pl-3 text-sm leading-relaxed text-soft">
                {s}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
