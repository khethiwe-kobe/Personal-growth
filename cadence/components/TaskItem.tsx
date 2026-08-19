"use client";

import { useState, useTransition } from "react";
import { toggleTaskAction, deleteTaskAction, updateTaskAction, moveTaskAction } from "@/app/actions";
import type { TaskRow, CategoryRow } from "@/lib/types";
import { PriorityBadge, Button } from "./ui";
import { IconCheck, IconEdit, IconX } from "./icons";
import { fmtClock, fmtMinutes, addDays } from "@/lib/time";

export default function TaskItem({
  task, category, categories, isPast,
}: {
  task: TaskRow;
  category: CategoryRow | null;
  categories: CategoryRow[];
  isPast: boolean;
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [checked, setChecked] = useState(!!task.completed);

  const toggle = () => {
    const next = !checked;
    setChecked(next);
    start(() => toggleTaskAction(task.id, next));
  };

  const late = task.completed && task.completed_at && task.completed_at.slice(0, 10) > task.date;
  const moved = !!task.original_date;

  return (
    <li className={`group px-4 py-3 ${checked ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          disabled={pending}
          aria-label={checked ? "Mark incomplete" : "Mark complete"}
          className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border ${
            checked
              ? "check-pop border-transparent bg-accent text-white"
              : "border-line-2 text-transparent hover:border-accent"
          }`}
        >
          <IconCheck size={13} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`truncate text-sm font-medium ${checked ? "line-through decoration-ink-3" : ""}`}>
              {task.name}
            </span>
            <PriorityBadge p={task.priority} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-3">
            {category && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: category.color }} />
                {category.name}
              </span>
            )}
            <span>
              {task.start_min !== null && task.end_min !== null
                ? `${fmtClock(task.start_min)}–${fmtClock(task.end_min)}`
                : fmtMinutes(task.planned_minutes)}
            </span>
            {late && <span className="text-warn">done late</span>}
            {moved && <span>moved from {task.original_date}</span>}
            {task.notes && <span title={task.notes}>· has note</span>}
          </div>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="rounded-lg p-1.5 text-ink-3 opacity-0 transition-opacity hover:bg-surface-2 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
          aria-label="Edit task"
        >
          {editing ? <IconX size={15} /> : <IconEdit size={15} />}
        </button>
      </div>

      {editing && (
        <div className="fade-up mt-3 rounded-xl bg-surface-2 p-3">
          <form action={(fd) => { setEditing(false); return updateTaskAction(fd); }} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input type="hidden" name="id" value={task.id} />
            <label className="col-span-2 block sm:col-span-4">
              <span className="mb-1 block text-[11px] text-ink-3">Task</span>
              <input name="name" defaultValue={task.name} required />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-3">Category</span>
              <select name="category_id" defaultValue={task.category_id ?? ""}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-3">Priority</span>
              <select name="priority" defaultValue={task.priority}>
                <option value="A">A — must do</option>
                <option value="B">B — important</option>
                <option value="C">C — nice to do</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-ink-3">Minutes</span>
              <input name="planned_minutes" type="number" min={5} max={1440} defaultValue={task.planned_minutes} />
            </label>
            <div className="flex gap-2">
              <label className="block flex-1">
                <span className="mb-1 block text-[11px] text-ink-3">Start</span>
                <input name="start_time" type="time" defaultValue={task.start_min !== null ? fmtClock(task.start_min) : ""} />
              </label>
              <label className="block flex-1">
                <span className="mb-1 block text-[11px] text-ink-3">End</span>
                <input name="end_time" type="time" defaultValue={task.end_min !== null ? fmtClock(task.end_min) : ""} />
              </label>
            </div>
            <label className="col-span-2 block sm:col-span-4">
              <span className="mb-1 block text-[11px] text-ink-3">Private note</span>
              <textarea name="notes" rows={2} defaultValue={task.notes} />
            </label>
            <input type="hidden" name="to_date" value={addDays(task.date, 1)} />
            <div className="col-span-2 flex items-center gap-2 sm:col-span-4">
              <Button className="!py-1.5">Save</Button>
              {!checked && (
                <Button variant="ghost" className="!py-1.5" formAction={moveTaskAction}>
                  Move to tomorrow
                </Button>
              )}
              <Button variant="danger" className="ml-auto !py-1.5" formAction={deleteTaskAction}>
                Delete
              </Button>
            </div>
          </form>
        </div>
      )}
    </li>
  );
}
