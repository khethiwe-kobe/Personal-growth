"use client";

import { useActionState, useState, useTransition } from "react";
import { parseTimetableAction, saveParsedTimetableAction } from "@/app/actions";
import { Button } from "./ui";
import { fmtClock } from "@/lib/time";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Entry = { day_of_week: number; start_min: number; end_min: number; title: string; location: string };

export default function TimetableImport() {
  const [state, action, pending] = useActionState(
    parseTimetableAction, null as { error?: string; entries?: Entry[] } | null
  );
  const [edited, setEdited] = useState<Entry[] | null>(null);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);

  const entries = edited ?? state?.entries ?? null;

  const update = (i: number, patch: Partial<Entry>) => {
    if (!entries) return;
    const next = entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e));
    setEdited(next);
  };
  const remove = (i: number) => {
    if (!entries) return;
    setEdited(entries.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-4">
      <form action={(fd) => { setEdited(null); setSaved(false); return action(fd); }} className="space-y-2">
        <textarea
          name="text" rows={6}
          placeholder={"Paste or type your timetable, one line per class:\n\nMonday 08:00-10:00 Software Engineering (B2)\nMonday 11:00-13:00 Databases (Lab 4)\nTuesday 14:00-16:00 Networks"}
          className="font-mono text-xs"
        />
        <Button variant="soft" disabled={pending}>{pending ? "Reading…" : "Read timetable text"}</Button>
        {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      </form>

      {entries && entries.length > 0 && !saved && (
        <div className="fade-up rounded-2xl border border-line bg-surface p-4">
          <p className="mb-3 text-sm font-medium">
            Found {entries.length} entr{entries.length === 1 ? "y" : "ies"} — review and edit before saving.
          </p>
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-xl bg-surface-2 p-2 sm:grid-cols-[8rem_5.5rem_5.5rem_1fr_8rem_2rem]">
                <select value={e.day_of_week} onChange={(ev) => update(i, { day_of_week: Number(ev.target.value) })}>
                  {DAYS.map((d, di) => <option key={d} value={di}>{d}</option>)}
                </select>
                <input type="time" value={fmtClock(e.start_min)}
                  onChange={(ev) => {
                    const [h, m] = ev.target.value.split(":").map(Number);
                    if (!Number.isNaN(h)) update(i, { start_min: h * 60 + m });
                  }} />
                <input type="time" value={fmtClock(e.end_min)}
                  onChange={(ev) => {
                    const [h, m] = ev.target.value.split(":").map(Number);
                    if (!Number.isNaN(h)) update(i, { end_min: h * 60 + m });
                  }} />
                <input value={e.title} onChange={(ev) => update(i, { title: ev.target.value })} placeholder="Title" />
                <input value={e.location} onChange={(ev) => update(i, { location: ev.target.value })} placeholder="Location" />
                <button type="button" onClick={() => remove(i)} aria-label="Remove"
                  className="pb-2 text-ink-3 hover:text-danger">×</button>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button
              disabled={saving}
              type="button"
              onClick={() =>
                startSave(async () => {
                  await saveParsedTimetableAction(entries);
                  setSaved(true);
                  setEdited(null);
                })
              }
            >
              {saving ? "Saving…" : `Save ${entries.length} entries to my timetable`}
            </Button>
          </div>
        </div>
      )}
      {saved && <p className="text-sm font-medium text-ok">Saved to your timetable.</p>}
    </div>
  );
}
