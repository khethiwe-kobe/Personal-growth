"use client";

import { useActionState, useState } from "react";
import { createTaskAction, createBlockAction, importTimetableToDayAction } from "@/app/actions";
import type { CategoryRow } from "@/lib/types";
import { Button } from "./ui";
import { IconPlus } from "./icons";

export function AddTaskForm({
  date, categories, hasTimetable,
}: { date: string; categories: CategoryRow[]; hasTimetable: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="soft" type="button" onClick={() => setOpen(true)}>
          <IconPlus size={15} /> Add task
        </Button>
        {hasTimetable && (
          <form action={importTimetableToDayAction}>
            <input type="hidden" name="date" value={date} />
            <Button variant="ghost">Pull in today's timetable</Button>
          </form>
        )}
      </div>
    );
  }
  return (
    <form
      action={async (fd) => { await createTaskAction(fd); }}
      className="fade-up grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-4"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <input type="hidden" name="date" value={date} />
      <label className="col-span-2 block sm:col-span-4">
        <span className="mb-1 block text-[11px] text-ink-3">Task</span>
        <input name="name" placeholder="What needs to happen?" autoFocus required />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Category</span>
        <select name="category_id" defaultValue="">
          <option value="">None</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Priority</span>
        <select name="priority" defaultValue="B">
          <option value="A">A — must do</option>
          <option value="B">B — important</option>
          <option value="C">C — nice to do</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Minutes</span>
        <input name="planned_minutes" type="number" min={5} max={1440} defaultValue={30} />
      </label>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-[11px] text-ink-3">Start</span>
          <input name="start_time" type="time" />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-[11px] text-ink-3">End</span>
          <input name="end_time" type="time" />
        </label>
      </div>
      <label className="col-span-2 block sm:col-span-4">
        <span className="mb-1 block text-[11px] text-ink-3">Private note (only you see this)</span>
        <textarea name="notes" rows={2} />
      </label>
      <div className="col-span-2 flex gap-2 sm:col-span-4">
        <Button>Add task</Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}

const BLOCK_KINDS = [
  ["sleep", "Sleep"], ["focus", "Focused work"], ["break", "Break"], ["rest", "Rest"],
  ["travel", "Travel"], ["social", "Social"], ["personal", "Personal"],
  ["unplanned", "Unplanned"], ["other", "Other"],
] as const;

export function AddBlockForm({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    createBlockAction,
    null as { error?: string; ok?: string } | null
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-accent-ink hover:underline"
      >
        + Account for time (sleep, break, travel…)
      </button>
    );
  }

  return (
    <form action={action} className="fade-up mt-2 space-y-2 rounded-xl bg-surface-2 p-3">
      <input type="hidden" name="date" value={date} />

      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Type</span>
        <select name="kind" defaultValue="sleep" className="w-full">
          {BLOCK_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      {/* Times get a row to themselves: a native time input needs real width
          to show anything but its icon. */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-ink-3">From</span>
          <input name="start_time" type="time" required className="w-full" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-ink-3">To</span>
          <input name="end_time" type="time" required className="w-full" />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Label (optional)</span>
        <input name="label" placeholder="e.g. Sleep, Lunch, Drive to campus" className="w-full" />
      </label>

      <p className="text-[11px] leading-relaxed text-ink-3">
        Crossing midnight is fine — 22:30 to 06:30 is split across the two days for you.
      </p>

      {state?.error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-[11px] text-danger">{state.error}</p>
      )}
      {state?.ok ? <p className="text-[11px] text-ok">{state.ok}</p> : null}

      <div className="flex items-center gap-2 pt-1">
        <Button className="!py-2 flex-1" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
        <Button variant="ghost" type="button" className="!py-2" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
