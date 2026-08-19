"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import type { MealPlanEntry } from "@/lib/types";
import { addIngredientsToList, useMeals } from "@/lib/meals";
import { logActivity } from "@/lib/data";
import { DAY_NAMES, MEAL_SLOTS } from "@/lib/constants";
import { shiftWeek, weekLabel, weekStartISO } from "@/lib/format";
import { Button, Card, PageHeader, Select } from "@/components/ui";

export default function PlannerPage() {
  const { sb, household, user } = useApp();
  const { meals, loading: mealsLoading } = useMeals();
  const [week, setWeek] = useState(weekStartISO());
  const [entries, setEntries] = useState<MealPlanEntry[] | null>(null);
  const [notice, setNotice] = useState("");

  const loadWeek = useCallback(async () => {
    if (!household) return;
    const { data } = await sb
      .from("meal_plan")
      .select("*")
      .eq("household_id", household.id)
      .eq("week_start", week);
    setEntries((data ?? []) as MealPlanEntry[]);
  }, [sb, household, week]);

  useEffect(() => {
    setEntries(null);
    loadWeek();
  }, [loadWeek]);

  const grid = useMemo(() => {
    const map = new Map<string, MealPlanEntry>();
    for (const e of entries ?? []) map.set(`${e.day}-${e.slot}`, e);
    return map;
  }, [entries]);

  async function setCell(day: number, slot: string, mealId: string) {
    if (!household || !user) return;
    const existing = grid.get(`${day}-${slot}`);
    if (!mealId) {
      if (existing) {
        await sb.from("meal_plan").delete().eq("id", existing.id);
        setEntries((l) => (l ?? []).filter((e) => e.id !== existing.id));
      }
      return;
    }
    const { data, error } = await sb
      .from("meal_plan")
      .upsert(
        { household_id: household.id, week_start: week, day, slot, meal_id: mealId },
        { onConflict: "household_id,week_start,day,slot" },
      )
      .select("*")
      .single();
    if (!error && data) {
      setEntries((l) => [
        ...(l ?? []).filter((e) => !(e.day === day && e.slot === slot)),
        data as MealPlanEntry,
      ]);
      const meal = meals.find((m) => m.id === mealId);
      await logActivity(sb, household.id, user.id, "plan", "meal_plan", data.id,
        `planned "${meal?.name ?? "a meal"}" for ${DAY_NAMES[day]} ${slot}`);
    }
  }

  async function sendIngredients() {
    if (!household || !user || !entries) return;
    const planned = new Set(entries.map((e) => e.meal_id));
    const ingredients = meals
      .filter((m) => planned.has(m.id))
      .flatMap((m) => m.ingredients);
    const n = await addIngredientsToList(sb, household.id, user.id, ingredients);
    setNotice(
      n
        ? `Added ${n} ingredient${n > 1 ? "s" : ""} to the grocery list.`
        : "Everything this week needs is already on the list.",
    );
    setTimeout(() => setNotice(""), 4000);
  }

  const plannedCount = new Set((entries ?? []).map((e) => e.meal_id)).size;

  return (
    <div>
      <PageHeader
        title="Meal planner"
        description="Plan the week, then send the ingredients straight to the grocery list."
        actions={
          <>
            <div className="inline-flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Previous week">
                &#8249;
              </Button>
              <span className="min-w-44 px-1 text-center text-sm font-semibold">{weekLabel(week)}</span>
              <Button size="sm" variant="ghost" onClick={() => setWeek(shiftWeek(week, 1))} aria-label="Next week">
                &#8250;
              </Button>
            </div>
            {plannedCount > 0 && (
              <Button onClick={sendIngredients}>Send ingredients to grocery list</Button>
            )}
          </>
        }
      />

      {notice ? <p className="mb-4 text-sm text-good">{notice}</p> : null}

      {mealsLoading || entries === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : meals.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">
            Save a few meal ideas first — the planner picks from those.
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-faint">
                <th className="px-4 py-3">Day</th>
                {MEAL_SLOTS.map((s) => (
                  <th key={s} className="px-4 py-3 capitalize">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_NAMES.map((dayName, day) => (
                <tr key={day} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{dayName}</td>
                  {MEAL_SLOTS.map((slot) => {
                    const entry = grid.get(`${day}-${slot}`);
                    return (
                      <td key={slot} className="px-3 py-2">
                        <Select
                          value={entry?.meal_id ?? ""}
                          onChange={(e) => setCell(day, slot, e.target.value)}
                          className="min-w-36"
                        >
                          <option value="">—</option>
                          {meals.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
