"use client";

import { useState } from "react";
import { Button, Card, Check, Field, Input, PageTitle, SectionTitle, Tag } from "@/components/ui";
import { useStore } from "@/lib/storage";
import type { ChecklistItem, DayMeals, FavoriteMeal, MealWeek } from "@/lib/types";
import { addDays, formatShort, todayISO, uid, weekStart } from "@/lib/dates";

const SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;
const EMPTY_DAY: DayMeals = { breakfast: "", lunch: "", dinner: "", snacks: "", waterCups: 0 };

export default function MealsPage() {
  const today = todayISO();
  const [weekOf, setWeekOf] = useState(weekStart(today));
  const [weeks, setWeeks] = useStore<Record<string, MealWeek>>("meals", {});
  const [favorites, setFavorites] = useStore<FavoriteMeal[]>("favMeals", []);
  const [newItem, setNewItem] = useState("");
  const [newPrep, setNewPrep] = useState("");

  const week: MealWeek = weeks[weekOf] || { weekStart: weekOf, days: {}, shopping: [], prep: [] };
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i));

  function saveWeek(patch: Partial<MealWeek>) {
    setWeeks((prev) => ({ ...prev, [weekOf]: { ...week, ...patch } }));
  }

  function setDay(date: string, patch: Partial<DayMeals>) {
    saveWeek({ days: { ...week.days, [date]: { ...(week.days[date] || EMPTY_DAY), ...patch } } });
  }

  function repeatLastWeek() {
    const prevWeek = weeks[addDays(weekOf, -7)];
    if (!prevWeek) return;
    const mapped: Record<string, DayMeals> = {};
    Object.entries(prevWeek.days).forEach(([date, meals]) => {
      mapped[addDays(date, 7)] = { ...meals, waterCups: 0 };
    });
    saveWeek({
      days: mapped,
      shopping: prevWeek.shopping.map((s) => ({ ...s, id: uid(), done: false })),
      prep: prevWeek.prep.map((p) => ({ ...p, id: uid(), done: false })),
    });
  }

  function addChecklist(kind: "shopping" | "prep", text: string) {
    if (!text.trim()) return;
    const item: ChecklistItem = { id: uid(), text: text.trim(), done: false };
    saveWeek({ [kind]: [...week[kind], item] } as Partial<MealWeek>);
  }

  function toggleItem(kind: "shopping" | "prep", id: string) {
    saveWeek({ [kind]: week[kind].map((i) => (i.id === id ? { ...i, done: !i.done } : i)) } as Partial<MealWeek>);
  }

  const saveFavorite = (slot: (typeof SLOTS)[number], name: string) => {
    if (!name.trim() || favorites.some((f) => f.slot === slot && f.name === name.trim())) return;
    setFavorites((prev) => [...prev, { id: uid(), name: name.trim(), slot }]);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Meal Planning" subtitle="Plan the week's meals on purpose — nourishment that serves your training and your peace of mind." />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setWeekOf(addDays(weekOf, -7))}>
          Previous week
        </Button>
        <span className="px-2 font-display text-lg text-ink">Week of {formatShort(weekOf)}</span>
        <Button variant="ghost" onClick={() => setWeekOf(addDays(weekOf, 7))}>
          Next week
        </Button>
        <div className="ml-auto">
          <Button variant="ghost" onClick={repeatLastWeek}>
            Repeat last week
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {days.map((date) => {
          const d = week.days[date] || EMPTY_DAY;
          const isToday = date === today;
          return (
            <Card key={date} className={isToday ? "border-brown-faint" : ""}>
              <div className="mb-3 flex items-baseline justify-between">
                <p className="font-display text-lg text-ink">
                  {new Date(date + "T00:00").toLocaleDateString("en-GB", { weekday: "long" })}
                  <span className="ml-2 text-sm text-faint">{formatShort(date)}</span>
                </p>
                {isToday && <Tag tone="brown">today</Tag>}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                {SLOTS.map((slot) => (
                  <Field key={slot} label={slot}>
                    <div className="flex gap-1">
                      <Input
                        list={`fav-${slot}`}
                        value={d[slot]}
                        onChange={(e) => setDay(date, { [slot]: e.target.value })}
                        placeholder="—"
                      />
                      <button
                        title="Save as favourite"
                        onClick={() => saveFavorite(slot, d[slot])}
                        className="shrink-0 rounded-lg border border-line px-2 text-xs text-faint transition-colors hover:border-brown-faint hover:text-brown"
                      >
                        Save
                      </button>
                    </div>
                    <datalist id={`fav-${slot}`}>
                      {favorites.filter((f) => f.slot === slot).map((f) => (
                        <option key={f.id} value={f.name} />
                      ))}
                    </datalist>
                  </Field>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-faint">Water</span>
                <div className="flex gap-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setDay(date, { waterCups: i + 1 === d.waterCups ? i : i + 1 })}
                      className={`h-5 w-5 rounded-md border transition-colors ${
                        i < d.waterCups ? "border-brown bg-brown-soft" : "border-line bg-card hover:border-brown-faint"
                      }`}
                      title={`${i + 1} of 8 cups`}
                    />
                  ))}
                </div>
                <span className="text-xs text-faint">{d.waterCups}/8 cups</span>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>Shopping list</SectionTitle>
          <div className="mb-3 flex gap-2">
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" onKeyDown={(e) => { if (e.key === "Enter") { addChecklist("shopping", newItem); setNewItem(""); } }} />
            <Button variant="ghost" onClick={() => { addChecklist("shopping", newItem); setNewItem(""); }}>
              Add
            </Button>
          </div>
          <ul className="space-y-2">
            {week.shopping.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <Check checked={i.done} onChange={() => toggleItem("shopping", i.id)} label={i.text} />
                <Button variant="quiet" onClick={() => saveWeek({ shopping: week.shopping.filter((x) => x.id !== i.id) })}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          {week.shopping.length === 0 && <p className="text-sm text-faint">Nothing on the list.</p>}
        </Card>
        <Card>
          <SectionTitle>Meal prep checklist</SectionTitle>
          <div className="mb-3 flex gap-2">
            <Input value={newPrep} onChange={(e) => setNewPrep(e.target.value)} placeholder="Add a prep task" onKeyDown={(e) => { if (e.key === "Enter") { addChecklist("prep", newPrep); setNewPrep(""); } }} />
            <Button variant="ghost" onClick={() => { addChecklist("prep", newPrep); setNewPrep(""); }}>
              Add
            </Button>
          </div>
          <ul className="space-y-2">
            {week.prep.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <Check checked={i.done} onChange={() => toggleItem("prep", i.id)} label={i.text} />
                <Button variant="quiet" onClick={() => saveWeek({ prep: week.prep.filter((x) => x.id !== i.id) })}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          {week.prep.length === 0 && <p className="text-sm text-faint">No prep tasks yet.</p>}
        </Card>
      </div>

      {favorites.length > 0 && (
        <Card className="mt-6">
          <SectionTitle>Favourite meals</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {favorites.map((f) => (
              <span key={f.id} className="flex items-center gap-2 rounded-full bg-beige px-3 py-1 text-sm text-brown-deep">
                {f.name}
                <span className="text-xs text-faint">{f.slot}</span>
                <button className="text-xs text-faint hover:text-ink" onClick={() => setFavorites((prev) => prev.filter((x) => x.id !== f.id))}>
                  Remove
                </button>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
