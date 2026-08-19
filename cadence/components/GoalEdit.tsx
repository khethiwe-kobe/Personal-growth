"use client";

import { useActionState, useState } from "react";
import { updateGoalAction } from "@/app/actions";
import type { GoalRow, CategoryRow } from "@/lib/types";
import { Button } from "./ui";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function GoalEdit({
  goal, categories,
}: { goal: GoalRow; categories: CategoryRow[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    updateGoalAction, null as { error?: string; ok?: boolean } | null
  );
  const activeDays = new Set(goal.active_days.split(",").map(Number));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-xs font-medium text-accent-ink hover:underline">
        Edit goal details
      </button>
    );
  }
  return (
    <form action={action} className="fade-up grid grid-cols-2 gap-3">
      <input type="hidden" name="id" value={goal.id} />
      <input type="hidden" name="tracking_type" value={goal.tracking_type} />
      <label className="col-span-2 block">
        <span className="mb-1 block text-[11px] text-ink-3">Title</span>
        <input name="title" defaultValue={goal.title} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Category</span>
        <select name="category_id" defaultValue={goal.category_id ?? ""}>
          <option value="">General</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Unit</span>
        <input name="unit" defaultValue={goal.unit} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Target per {goal.frequency === "daily" ? "day" : goal.frequency === "weekly" ? "week" : "month"}</span>
        <input name="period_target" type="number" step="any" min={0.1} defaultValue={goal.period_target} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Minimum</span>
        <input name="minimum_target" type="number" step="any" min={0} defaultValue={goal.minimum_target || ""} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Overall target</span>
        <input name="overall_target" type="number" step="any" min={0} defaultValue={goal.overall_target ?? ""} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Deadline</span>
        <input name="deadline" type="date" defaultValue={goal.deadline ?? ""} />
      </label>
      {goal.frequency === "daily" && (
        <div className="col-span-2">
          <span className="mb-1 block text-[11px] text-ink-3">Days that count</span>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <label key={d} className="cursor-pointer">
                <input type="checkbox" name="active_days" value={i}
                  defaultChecked={activeDays.has(i)} className="peer sr-only" />
                <span className="inline-block rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-3 peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent-ink">
                  {d}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <label className="col-span-2 block">
        <span className="mb-1 block text-[11px] text-ink-3">Why (private)</span>
        <textarea name="why" rows={2} defaultValue={goal.why} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Measurement</span>
        <input name="measurement" defaultValue={goal.measurement} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Recurring action</span>
        <input name="daily_action" defaultValue={goal.daily_action} />
      </label>
      <label className="col-span-2 block">
        <span className="mb-1 block text-[11px] text-ink-3">Evidence (private)</span>
        <input name="evidence" defaultValue={goal.evidence} />
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="share_progress" defaultChecked={!!goal.share_progress} />
        Share progress numbers with my group
      </label>
      {state?.error && <p className="col-span-2 text-xs text-danger">{state.error}</p>}
      {state?.ok && <p className="col-span-2 text-xs text-ok">Saved.</p>}
      <div className="col-span-2 flex gap-2">
        <Button disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Close</Button>
      </div>
      <p className="col-span-2 text-[11px] text-ink-3">
        Your logged check-ins are never deleted. Changing the target re-evaluates past days against the new target.
      </p>
    </form>
  );
}
