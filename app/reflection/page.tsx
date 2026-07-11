"use client";

import { useState } from "react";
import { Button, Card, Field, PageTitle, SectionTitle, Tabs, Textarea } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { DailyReflection, MonthlyReflection, WeeklyReflection } from "@/lib/types";
import { addDays, formatLong, formatMonth, formatShort, monthKey, todayISO, weekStart } from "@/lib/dates";
import { recurringThemes } from "@/lib/companion";

export default function ReflectionPage() {
  const [tab, setTab] = useState("daily");
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle title="Reflection" subtitle="The unexamined day slips away. Pause, look back, and let honest reflection turn experience into growth." />
      <Tabs
        tabs={[
          { id: "daily", label: "Daily" },
          { id: "weekly", label: "Weekly" },
          { id: "monthly", label: "Monthly" },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "daily" && <DailyTab />}
      {tab === "weekly" && <WeeklyTab />}
      {tab === "monthly" && <MonthlyTab />}
    </div>
  );
}

function DailyTab() {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useStore<Record<string, DailyReflection>>("reflectDaily", {});
  const entry: DailyReflection = entries[date] || { date, wins: "", challenges: "", gratitude: "", lessons: "", tomorrowFocus: "" };
  const save = (patch: Partial<DailyReflection>) => setEntries((prev) => ({ ...prev, [date]: { ...entry, ...patch } }));

  const themes = recurringThemes(Object.values(entries).slice(-30));
  const past = Object.keys(entries).sort().reverse().filter((d) => d !== date).slice(0, 7);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setDate(addDays(date, -1))}>
          Previous day
        </Button>
        <span className="px-2 font-display text-lg text-ink">{formatLong(date)}</span>
        {date < today && (
          <Button variant="ghost" onClick={() => setDate(addDays(date, 1))}>
            Next day
          </Button>
        )}
      </div>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Wins">
            <Textarea value={entry.wins} onChange={(e) => save({ wins: e.target.value })} placeholder="What went well today?" />
          </Field>
          <Field label="Challenges">
            <Textarea value={entry.challenges} onChange={(e) => save({ challenges: e.target.value })} placeholder="What was hard?" />
          </Field>
          <Field label="Gratitude">
            <Textarea value={entry.gratitude} onChange={(e) => save({ gratitude: e.target.value })} placeholder="What are you thankful for?" />
          </Field>
          <Field label="Lessons">
            <Textarea value={entry.lessons} onChange={(e) => save({ lessons: e.target.value })} placeholder="What did today teach you?" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Tomorrow's focus">
            <Textarea rows={2} value={entry.tomorrowFocus} onChange={(e) => save({ tomorrowFocus: e.target.value })} placeholder="One thing for tomorrow." />
          </Field>
        </div>
      </Card>

      {themes.length > 0 && (
        <Card className="mt-4">
          <SectionTitle>Recurring themes</SectionTitle>
          <p className="mb-2 text-sm text-soft">Words that keep appearing in your last month of reflections:</p>
          <div className="flex flex-wrap gap-2">
            {themes.map((t) => (
              <span key={t} className="rounded-full bg-beige px-3 py-1 text-sm text-brown-deep">
                {t}
              </span>
            ))}
          </div>
        </Card>
      )}

      {past.length > 0 && (
        <div className="mt-6">
          <SectionTitle>Recent days</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {past.map((d) => (
              <Button key={d} variant="ghost" onClick={() => setDate(d)}>
                {formatShort(d)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyTab() {
  const [week, setWeek] = useState(weekStart(todayISO()));
  const [entries, setEntries] = useStore<Record<string, WeeklyReflection>>("reflectWeekly", {});
  const entry: WeeklyReflection = entries[week] || { weekStart: week, achievement: "", improve: "", spiritual: "", physical: "", mental: "" };
  const save = (patch: Partial<WeeklyReflection>) => setEntries((prev) => ({ ...prev, [week]: { ...entry, ...patch } }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setWeek(addDays(week, -7))}>
          Previous week
        </Button>
        <span className="px-2 font-display text-lg text-ink">Week of {formatShort(week)}</span>
        <Button variant="ghost" onClick={() => setWeek(addDays(week, 7))}>
          Next week
        </Button>
      </div>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Biggest achievement">
            <Textarea value={entry.achievement} onChange={(e) => save({ achievement: e.target.value })} placeholder="What are you most glad you did?" />
          </Field>
          <Field label="Areas to improve">
            <Textarea value={entry.improve} onChange={(e) => save({ improve: e.target.value })} placeholder="Where will next week be better?" />
          </Field>
          <Field label="Spiritual growth">
            <Textarea value={entry.spiritual} onChange={(e) => save({ spiritual: e.target.value })} placeholder="How did you grow toward God?" />
          </Field>
          <Field label="Physical growth">
            <Textarea value={entry.physical} onChange={(e) => save({ physical: e.target.value })} placeholder="Training, food, rest." />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Mental growth">
            <Textarea rows={2} value={entry.mental} onChange={(e) => save({ mental: e.target.value })} placeholder="What did you learn or read?" />
          </Field>
        </div>
      </Card>
    </div>
  );
}

function MonthlyTab() {
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [entries, setEntries] = useStore<Record<string, MonthlyReflection>>("reflectMonthly", {});
  const entry: MonthlyReflection = entries[month] || { month, goalsReview: "", habitsReview: "", growth: "", wins: "" };
  const save = (patch: Partial<MonthlyReflection>) => setEntries((prev) => ({ ...prev, [month]: { ...entry, ...patch } }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setMonth(monthKey(addDays(month + "-01", -1)))}>
          Previous month
        </Button>
        <span className="px-2 font-display text-lg text-ink">{formatMonth(month)}</span>
        <Button variant="ghost" onClick={() => setMonth(monthKey(addDays(month + "-28", 5)))}>
          Next month
        </Button>
      </div>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Review my goals">
            <Textarea value={entry.goalsReview} onChange={(e) => save({ goalsReview: e.target.value })} placeholder="Which goals moved? Which stalled, and why?" />
          </Field>
          <Field label="Review my habits">
            <Textarea value={entry.habitsReview} onChange={(e) => save({ habitsReview: e.target.value })} placeholder="What stuck? What needs a smaller first step?" />
          </Field>
          <Field label="How I grew">
            <Textarea value={entry.growth} onChange={(e) => save({ growth: e.target.value })} placeholder="Spiritually, mentally, physically." />
          </Field>
          <Field label="Celebrate the wins">
            <Textarea value={entry.wins} onChange={(e) => save({ wins: e.target.value })} placeholder="Name them. Thank God for them." />
          </Field>
        </div>
      </Card>
    </div>
  );
}
