"use client";

import { useMemo, useState } from "react";
import { Button, Card, Check, EmptyState, Input, PageTitle, SectionTitle, Stat } from "@/components/ui";
import { MonthHeatmap } from "@/components/viz";
import { useStore } from "@/lib/storage";
import type { Habit, HabitLog } from "@/lib/types";
import { addDays, formatMonth, lastNDays, monthKey, streakFrom, todayISO, uid } from "@/lib/dates";

const STARTER_HABITS = ["Bible reading", "Prayer", "Workout", "Water", "Sleep by 10pm", "Quiet time", "Reading", "Journaling"];

export default function HabitsPage() {
  const today = todayISO();
  const [habits, setHabits] = useStore<Habit[]>("habits", []);
  const [log, setLog] = useStore<HabitLog>("habitLog", {});
  const [name, setName] = useState("");
  const [month, setMonth] = useState(monthKey(today));

  const active = habits.filter((h) => !h.archived);

  function seed() {
    setHabits(STARTER_HABITS.map((n) => ({ id: uid(), name: n, createdAt: today })));
  }

  function add() {
    if (!name.trim()) return;
    setHabits((prev) => [...prev, { id: uid(), name: name.trim(), createdAt: today }]);
    setName("");
  }

  function toggle(habitId: string, date: string) {
    setLog((prev) => ({
      ...prev,
      [habitId]: { ...(prev[habitId] || {}), [date]: !prev[habitId]?.[date] },
    }));
  }

  const streak = (h: Habit) => streakFrom(new Set(Object.entries(log[h.id] || {}).filter(([, v]) => v).map(([d]) => d)));

  const pct30 = (h: Habit) => {
    const range = lastNDays(30);
    const done = range.filter((d) => log[h.id]?.[d]).length;
    return Math.round((done / 30) * 100);
  };

  const doneToday = active.filter((h) => log[h.id]?.[today]).length;

  // Heatmap data for the selected month: count of habits completed per day
  const monthDays = useMemo(() => {
    const start = month + "-01";
    const out: string[] = [];
    for (let d = start; monthKey(d) === month; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);
  const counts: Record<string, number> = {};
  for (const d of monthDays) counts[d] = active.filter((h) => log[h.id]?.[d]).length;

  const last7 = lastNDays(7);

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Habits" subtitle="Small faithful acts, repeated daily, become the shape of a life." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Today" value={`${doneToday} / ${active.length}`} hint="habits completed" />
        <Stat
          label="Best current streak"
          value={`${active.length ? Math.max(0, ...active.map(streak)) : 0}d`}
          hint={active.length ? active.reduce((a, b) => (streak(a) >= streak(b) ? a : b)).name : ""}
        />
        <Stat
          label="30-day consistency"
          value={`${active.length ? Math.round(active.reduce((s, h) => s + pct30(h), 0) / active.length) : 0}%`}
          hint="all habits"
        />
      </div>

      <Card className="mt-6">
        <SectionTitle>Add a habit</SectionTitle>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Evening walk" onKeyDown={(e) => e.key === "Enter" && add()} />
          <Button onClick={add} disabled={!name.trim()}>
            Add
          </Button>
        </div>
        {habits.length === 0 && (
          <p className="mt-3 text-sm text-soft">
            Or{" "}
            <button className="text-brown underline-offset-2 hover:underline" onClick={seed}>
              start with a suggested set
            </button>{" "}
            — Bible reading, prayer, workout, water, sleep, quiet time, reading, journaling.
          </p>
        )}
      </Card>

      <section className="mt-8">
        <SectionTitle>This week</SectionTitle>
        {active.length === 0 ? (
          <EmptyState title="No habits yet." hint="Add one above to begin." />
        ) : (
          <Card className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="px-5 py-3 font-medium">Habit</th>
                  {last7.map((d) => (
                    <th key={d} className={`px-2 py-3 text-center font-medium ${d === today ? "text-brown" : ""}`}>
                      {new Date(d + "T00:00").toLocaleDateString("en-GB", { weekday: "narrow" })}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-medium">Streak</th>
                  <th className="px-3 py-3 text-right font-medium">30d</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {active.map((h) => (
                  <tr key={h.id} className="border-b border-line-soft">
                    <td className="px-5 py-2.5 text-ink">{h.name}</td>
                    {last7.map((d) => (
                      <td key={d} className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => toggle(h.id, d)}
                          className={`h-6 w-6 rounded-lg border transition-colors ${
                            log[h.id]?.[d] ? "border-brown bg-brown" : "border-line bg-card hover:border-brown-faint"
                          }`}
                          title={`${h.name} — ${d}`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right text-soft">{streak(h)}d</td>
                    <td className="px-3 py-2.5 text-right text-soft">{pct30(h)}%</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        variant="quiet"
                        onClick={() => setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, archived: true } : x)))}
                      >
                        Archive
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Monthly heat map</SectionTitle>
            <div className="flex gap-1">
              <Button variant="quiet" onClick={() => setMonth(monthKey(addDays(month + "-01", -1)))}>
                Prev
              </Button>
              <Button variant="quiet" onClick={() => setMonth(monthKey(addDays(monthDays[monthDays.length - 1], 1)))}>
                Next
              </Button>
            </div>
          </div>
          <p className="mb-3 text-sm text-soft">{formatMonth(month)} — darker means more habits completed that day.</p>
          <MonthHeatmap days={monthDays} counts={counts} max={Math.max(1, active.length)} />
        </Card>
        {habits.some((h) => h.archived) && (
          <Card>
            <SectionTitle>Archived</SectionTitle>
            <ul className="space-y-2">
              {habits
                .filter((h) => h.archived)
                .map((h) => (
                  <li key={h.id} className="flex items-center justify-between text-sm text-soft">
                    {h.name}
                    <span className="flex gap-2">
                      <Button variant="quiet" onClick={() => setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, archived: false } : x)))}>
                        Restore
                      </Button>
                      <Button variant="quiet" onClick={() => setHabits((prev) => prev.filter((x) => x.id !== h.id))}>
                        Delete
                      </Button>
                    </span>
                  </li>
                ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
