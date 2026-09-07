"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveDayTasksAction } from "@/app/actions";
import { Button } from "./ui";

/**
 * "I planned this on the wrong day." Moves the whole day's tasks onto another
 * date exactly as they are — same times, order, priorities, categories, notes
 * and ticks — rather than making you retype them or move them one by one.
 */
export default function MoveDayTasks({
  date, count, defaultTo,
}: { date: string; count: number; defaultTo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (count === 0) return null;

  const move = () =>
    start(async () => {
      setError(null);
      const res = await moveDayTasksAction(date, to);
      if ("error" in res) { setError(res.error); return; }
      setOpen(false);
      router.push(`/today?date=${to}`);
      router.refresh();
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-[11px] font-medium text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
      >
        Wrong day? Move {count === 1 ? "this task" : `all ${count} tasks`} to another date
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
      <p className="text-xs font-medium">
        Move {count === 1 ? "this task" : `all ${count} tasks`} to
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm"
        />
        <Button type="button" onClick={move} disabled={pending} className="!py-1.5 !text-xs">
          {pending ? "Moving…" : "Move"}
        </Button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); }}
          className="text-xs text-ink-3 hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}
      <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
        Everything comes across exactly as it is — times, order, priorities,
        categories, notes and anything already ticked. Nothing is rescheduled and
        nothing is marked as moved. Move them back the same way if you need to.
      </p>
    </div>
  );
}
