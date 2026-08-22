"use client";

import { useActionState, useState } from "react";
import {
  createTaskAction, createBlockAction, importTimetableToDayAction, addCategoryInlineAction,
} from "@/app/actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CategoryRow } from "@/lib/types";
import { Button } from "./ui";
import { IconPlus } from "./icons";

export function AddTaskForm({
  date, categories, hasTimetable,
}: { date: string; categories: CategoryRow[]; hasTimetable: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState(categories);
  const [categoryId, setCategoryId] = useState("");
  const [newCat, setNewCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#b7c4d6");
  const [savingCat, setSavingCat] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Create a category from here and select it immediately, rather than
  // sending someone to Settings mid-thought.
  const addCategory = async () => {
    if (savingCat || !catName.trim()) return;
    setSavingCat(true);
    setCatError(null);
    try {
      const res = await addCategoryInlineAction(catName, catColor);
      if ("error" in res) { setCatError(res.error); return; }
      setCats((prev) => [...prev, { ...(res as CategoryRow) } as CategoryRow]);
      setCategoryId(String(res.id));
      setCatName("");
      setNewCat(false);
      router.refresh();
    } catch {
      setCatError("Couldn't save it — reload the page and try again.");
    } finally {
      setSavingCat(false);
    }
  };

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

      <div className="col-span-2 block sm:col-span-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-ink-3">Category</span>
          <button
            type="button"
            onClick={() => setNewCat((v) => !v)}
            className="text-[11px] font-medium text-accent-ink hover:underline"
          >
            {newCat ? "Cancel" : "+ New"}
          </button>
        </div>
        <select
          name="category_id"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full"
        >
          <option value="">None</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="col-span-2 block sm:col-span-1">
        <span className="mb-1 block text-[11px] text-ink-3">Tag</span>
        <label
          className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink"
          title="Done together in the focus room. Works with any category — school, church, work — and can only be ticked once you've actually sat in the room with it selected."
        >
          <input type="checkbox" name="focus_room" />
          Focus session
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Priority</span>
        <select name="priority" defaultValue="B" className="w-full">
          <option value="A">A — must do</option>
          <option value="B">B — important</option>
          <option value="C">C — nice to do</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Minutes</span>
        <input name="planned_minutes" type="number" min={5} max={1440} defaultValue={30}
          className="w-full" />
      </label>

      {/* Start and End each get their own cell — sharing one column clipped
          the End field off the edge of the card. */}
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Start</span>
        <input name="start_time" type="time" className="w-full" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">End</span>
        <input name="end_time" type="time" className="w-full" />
      </label>

      {newCat && (
        <div className="col-span-2 flex flex-wrap items-end gap-2 rounded-xl bg-surface-2 p-2 sm:col-span-3">
          <label className="block min-w-[8rem] flex-1">
            <span className="mb-1 block text-[11px] text-ink-3">New category</span>
            <input
              value={catName} onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Ministry, Side project" maxLength={40} className="w-full"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-ink-3">Colour</span>
            <input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)}
              className="h-9 w-14 cursor-pointer p-1" />
          </label>
          <Button type="button" variant="soft" className="!py-2" onClick={addCategory}
            disabled={savingCat || !catName.trim()}>
            {savingCat ? "Adding…" : "Add"}
          </Button>
          {catError && <p className="w-full text-[11px] text-danger">{catError}</p>}
        </div>
      )}

      <label className="col-span-2 block sm:col-span-4">
        <span className="mb-1 block text-[11px] text-ink-3">Private note (only you see this)</span>
        <textarea name="notes" rows={2} />
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-3">
        <Button>Add task</Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Close</Button>
        <Link href="/settings" className="ml-auto text-[11px] text-ink-3 hover:text-accent-ink hover:underline">
          Rename or remove categories →
        </Link>
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [night, setNight] = useState("last");
  const crossesMidnight = !!from && !!to && to < from;

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
          <input name="start_time" type="time" required className="w-full"
            value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-ink-3">To</span>
          <input name="end_time" type="time" required className="w-full"
            value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {/* Only asked when it matters — when the times actually cross midnight. */}
      {crossesMidnight && (
        <div className="rounded-xl bg-surface-2 p-2">
          <span className="mb-1 block text-[11px] text-ink-3">Which night?</span>
          <div className="flex flex-wrap gap-3">
            {([
              ["last", "Last night", "fills this morning"],
              ["next", "Tonight", "runs into tomorrow"],
            ] as [string, string, string][]).map(([v, l, hint]) => (
              <label key={v} className="flex items-center gap-1.5 text-xs">
                <input type="radio" name="night" value={v}
                  checked={night === v} onChange={() => setNight(v)} />
                <span>{l}</span>
                <span className="text-[11px] text-ink-3">({hint})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Label (optional)</span>
        <input name="label" placeholder="e.g. Sleep, Lunch, Drive to campus" className="w-full" />
      </label>

      <p className="text-[11px] leading-relaxed text-ink-3">
        Crossing midnight is fine — say which night and it is split across the two days
        for you.
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
