"use client";

import { useState, useTransition } from "react";
import { toggleTaskAction, createTaskAction } from "@/app/actions";
import type { TaskRow, CategoryRow } from "@/lib/types";
import { PriorityBadge } from "./ui";
import { IconCheck } from "./icons";
import { useRouter } from "next/navigation";

/**
 * Today's list, tickable without leaving the timer. Compact on purpose: this
 * is for keeping your eye on what the session is *for*, not for planning.
 */
export default function FocusTasks({
  tasks, categories, date, compact = false,
}: {
  tasks: TaskRow[];
  categories: CategoryRow[];
  date: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Record<number, boolean>>(
    () => Object.fromEntries(tasks.map((t) => [t.id, !!t.completed]))
  );
  const [adding, setAdding] = useState("");
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const toggle = (t: TaskRow) => {
    const next = !done[t.id];
    setDone((d) => ({ ...d, [t.id]: next }));
    start(async () => {
      await toggleTaskAction(t.id, next);
      router.refresh();
    });
  };

  const add = () => {
    const name = adding.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("date", date);
    fd.set("priority", "B");
    setAdding("");
    start(async () => {
      await createTaskAction(fd);
      router.refresh();
    });
  };

  const remaining = tasks.filter((t) => !done[t.id]).length;

  return (
    <div className={compact ? "" : "space-y-3"}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className={compact ? "text-sm font-medium" : "font-display text-lg font-medium"}>
          Today&apos;s list
        </h3>
        <span className="text-[11px] text-ink-3">
          {tasks.length === 0 ? "nothing planned" :
            remaining === 0 ? "all done" : `${remaining} left`}
        </span>
      </div>

      <ul className="space-y-1">
        {tasks.map((t) => {
          const cat = t.category_id ? catMap.get(t.category_id) : null;
          const checked = done[t.id];
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => toggle(t)}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    checked ? "border-transparent bg-accent text-white" : "border-line"
                  }`}
                >
                  {checked && <IconCheck size={11} />}
                </span>
                {cat && (
                  <span className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: cat.color }} aria-hidden />
                )}
                <span className={`min-w-0 flex-1 truncate ${checked ? "text-ink-3 line-through" : ""}`}>
                  {t.name}
                </span>
                <PriorityBadge p={t.priority} />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex gap-2">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Add something to the list…"
          maxLength={120}
          className="flex-1 text-sm"
        />
        <button
          type="button" onClick={add} disabled={pending || !adding.trim()}
          className="rounded-lg border border-line px-3 text-sm text-ink-2 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
