"use client";

import { useState } from "react";
import { createEventAction, updateEventAction, deleteEventAction, setCountdownAction } from "@/app/actions";
import type { EventRow } from "@/lib/types";
import { Button } from "./ui";
import { IconPlus, IconEdit, IconX } from "./icons";
import { fmtClock } from "@/lib/time";

const CATS: [string, string, string][] = [
  ["test", "Test", "#b7c4d6"], ["exam", "Exam", "#b7c4d6"], ["assignment", "Assignment", "#d9c9a8"],
  ["deadline", "Deadline", "#d9c9a8"], ["meeting", "Meeting", "#c4c4bc"], ["church", "Church", "#cbb9d9"],
  ["birthday", "Birthday", "#d9b8c4"], ["important", "Important", "#d6bcb4"],
  ["personal", "Personal", "#a8c5b4"], ["custom", "Custom", "#b8b8b0"],
];

function EventFields({ e, date }: { e?: EventRow; date?: string }) {
  const [cat, setCat] = useState(e?.category ?? "personal");
  const [color, setColor] = useState(e?.color ?? "#a8c5b4");
  return (
    <>
      <label className="col-span-2 block">
        <span className="mb-1 block text-[11px] text-ink-3">Title</span>
        <input name="title" defaultValue={e?.title} required maxLength={140} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Date</span>
        <input name="date" type="date" defaultValue={e?.date ?? date} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] text-ink-3">Category</span>
        <select
          name="category" value={cat}
          onChange={(ev) => {
            setCat(ev.target.value);
            const c = CATS.find(([v]) => v === ev.target.value);
            if (c && !e) setColor(c[2]);
          }}
        >
          {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="mb-1 block text-[11px] text-ink-3">Start</span>
          <input name="start_time" type="time" defaultValue={e?.start_min != null ? fmtClock(e.start_min) : ""} />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-[11px] text-ink-3">End</span>
          <input name="end_time" type="time" defaultValue={e?.end_min != null ? fmtClock(e.end_min) : ""} />
        </label>
      </div>
      <div className="flex gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-ink-3">Colour</span>
          <input name="color" type="color" value={color} onChange={(ev) => setColor(ev.target.value)} />
        </label>
        <label className="block flex-1">
          <span className="mb-1 block text-[11px] text-ink-3">Reminder</span>
          <select name="reminder_minutes" defaultValue={e?.reminder_minutes ?? ""}>
            <option value="">None</option>
            <option value="0">At the time</option>
            <option value="30">30 min before</option>
            <option value="60">1 hour before</option>
            <option value="1440">1 day before</option>
            <option value="2880">2 days before</option>
          </select>
        </label>
      </div>
      <label className="col-span-2 block">
        <span className="mb-1 block text-[11px] text-ink-3">Notes (private)</span>
        <textarea name="notes" rows={2} defaultValue={e?.notes} />
      </label>
    </>
  );
}

export function AddEventForm({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="soft" type="button" onClick={() => setOpen(true)}>
        <IconPlus size={15} /> Add event
      </Button>
    );
  return (
    <form
      action={async (fd) => { await createEventAction(fd); setOpen(false); }}
      className="fade-up grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-4"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <EventFields date={date} />
      <div className="col-span-2 flex gap-2">
        <Button>Add event</Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}

export function EventItem({ event, pinnedSlots }: { event: EventRow; pinnedSlots: number[] }) {
  const [editing, setEditing] = useState(false);
  const freeSlot = [1, 2, 3].find((s) => !pinnedSlots.includes(s));
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: event.color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{event.title}</p>
          <p className="text-xs text-ink-3">
            <span className="capitalize">{event.category}</span>
            {event.start_min != null && ` · ${fmtClock(event.start_min)}${event.end_min != null ? `–${fmtClock(event.end_min)}` : ""}`}
            {event.reminder_minutes != null && " · reminder set"}
            {event.notes && " · note"}
          </p>
        </div>
        {event.countdown_slot ? (
          <form action={setCountdownAction}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="slot" value="0" />
            <button className="rounded-lg bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent-ink" title="Remove from dashboard countdowns">
              Pinned #{event.countdown_slot} ×
            </button>
          </form>
        ) : freeSlot ? (
          <form action={setCountdownAction}>
            <input type="hidden" name="id" value={event.id} />
            <input type="hidden" name="slot" value={freeSlot} />
            <button className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink-3 hover:text-accent-ink" title="Pin as a dashboard countdown">
              Pin countdown
            </button>
          </form>
        ) : null}
        <button
          onClick={() => setEditing((v) => !v)}
          className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
          aria-label="Edit event"
        >
          {editing ? <IconX size={14} /> : <IconEdit size={14} />}
        </button>
      </div>
      {editing && (
        <form
          action={async (fd) => { await updateEventAction(fd); setEditing(false); }}
          className="fade-up mt-3 grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-3"
        >
          <input type="hidden" name="id" value={event.id} />
          <EventFields e={event} />
          <div className="col-span-2 flex gap-2">
            <Button className="!py-1.5">Save</Button>
            <Button variant="danger" className="ml-auto !py-1.5" formAction={deleteEventAction}>Delete</Button>
          </div>
        </form>
      )}
    </li>
  );
}
