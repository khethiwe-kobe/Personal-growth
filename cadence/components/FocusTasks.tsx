"use client";

import { useEffect, useState, useTransition } from "react";
import { toggleTaskAction, createTaskAction, updateTaskAction, deleteTaskAction } from "@/app/actions";
import type { TaskRow, CategoryRow } from "@/lib/types";
import { PriorityBadge } from "./ui";
import { IconCheck, IconEdit } from "./icons";
import { fmtClock as clock } from "@/lib/time";
import { useRouter } from "next/navigation";

/**
 * Today's list wherever it appears — the Focus page, inside the timer, in the
 * room. Tick, rename, retime, add and remove without going back to Today: a
 * list you can only read is a list you stop trusting.
 */
export default function FocusTasks({
  tasks, categories, date, compact = false, onProgress,
}: {
  tasks: TaskRow[];
  categories: CategoryRow[];
  date: string;
  compact?: boolean;
  onProgress?: (done: number, total: number) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Record<number, boolean>>(
    () => Object.fromEntries(tasks.map((t) => [t.id, !!t.completed]))
  );
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const openEdit = (t: TaskRow) => { setEditing(t.id); setDraft(t.name); };

  const saveEdit = (t: TaskRow) => {
    const name = draft.trim();
    setEditing(null);
    if (!name || name === t.name) return;
    const fd = new FormData();
    fd.set("id", String(t.id));
    fd.set("name", name);
    fd.set("priority", t.priority);
    fd.set("planned_minutes", String(t.planned_minutes));
    if (t.category_id) fd.set("category_id", String(t.category_id));
    if (t.start_min !== null) fd.set("start_time", clock(t.start_min));
    if (t.end_min !== null) fd.set("end_time", clock(t.end_min));
    fd.set("notes", t.notes ?? "");
    if (t.focus_room === 1) fd.set("focus_room", "on");
    start(async () => { await updateTaskAction(fd); router.refresh(); });
  };

  const remove = (t: TaskRow) => {
    const fd = new FormData();
    fd.set("id", String(t.id));
    start(async () => { await deleteTaskAction(fd); router.refresh(); });
  };

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
  const doneNow = tasks.length - remaining;
  useEffect(() => { onProgress?.(doneNow, tasks.length); }, [doneNow, tasks.length, onProgress]);

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
          if (editing === t.id) {
            return (
              <li key={t.id} className="flex items-center gap-1 px-2 py-1">
                <input
                  autoFocus value={draft} maxLength={120}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); saveEdit(t); }
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="min-w-0 flex-1 text-sm"
                />
                <button type="button" onClick={() => saveEdit(t)}
                  className="rounded px-1.5 py-1 text-[11px] text-accent-ink">Save</button>
                <button type="button" onClick={() => remove(t)}
                  className="rounded px-1.5 py-1 text-[11px] text-danger">Delete</button>
              </li>
            );
          }
          return (
            <li key={t.id} className="group flex items-center gap-1 rounded-lg hover:bg-surface-2">
              <button
                type="button"
                onClick={() => toggle(t)}
                disabled={pending}
                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
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
              <button
                type="button" onClick={() => openEdit(t)} aria-label={`Edit ${t.name}`}
                className="mr-1 rounded p-1 text-ink-3 opacity-0 hover:text-ink-2 focus:opacity-100 group-hover:opacity-100"
              >
                <IconEdit size={13} />
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
