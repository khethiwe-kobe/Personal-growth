"use client";

import { useState } from "react";

type Row = { name: string; sets: string; reps: string; load: string };

const emptyRow = (): Row => ({ name: "", sets: "", reps: "", load: "" });

/** Builds a structured report message so post-session check-ins are quick. */
export function ReportForm({ onSubmit, onClose, session }: { onSubmit: (text: string) => void; onClose: () => void; session?: string }) {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [allSets, setAllSets] = useState<"yes" | "no">("yes");
  const [easy, setEasy] = useState("");
  const [hard, setHard] = useState("");
  const [pain, setPain] = useState("");
  const [missed, setMissed] = useState("");
  const [notes, setNotes] = useState("");

  const update = (i: number, key: keyof Row, value: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));

  const submit = () => {
    const done = rows.filter((r) => r.name.trim());
    const lines = [
      `Session report${session ? ` for ${session}` : ""}:`,
      ...done.map((r) => `- ${r.name.trim()}: ${[r.sets && `${r.sets} sets`, r.reps && `reps ${r.reps}`, r.load && `load ${r.load}`].filter(Boolean).join(", ")}`),
      `All prescribed sets completed: ${allSets}.`,
      easy && `Felt easy: ${easy}.`,
      hard && `Felt hard: ${hard}.`,
      `Pain or discomfort: ${pain || "none"}.`,
      missed && `Could not complete: ${missed}.`,
      notes && `Notes: ${notes}`,
    ].filter(Boolean);
    onSubmit(lines.join("\n"));
  };

  return (
    <div className="card p-5 fade-in">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg">Report a session</h3>
        <button className="text-sm text-ink-3 hover:text-ink" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="grid grid-cols-[1fr_64px_88px_96px] gap-2 text-xs text-ink-3 mb-1 px-1">
        <span>Exercise</span>
        <span>Sets</span>
        <span>Reps</span>
        <span>Load</span>
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_64px_88px_96px] gap-2">
            <input className="input" placeholder="Back squat" value={r.name} onChange={(e) => update(i, "name", e.target.value)} />
            <input className="input" placeholder="4" value={r.sets} onChange={(e) => update(i, "sets", e.target.value)} />
            <input className="input" placeholder="6,6,5,5" value={r.reps} onChange={(e) => update(i, "reps", e.target.value)} />
            <input className="input" placeholder="80 kg" value={r.load} onChange={(e) => update(i, "load", e.target.value)} />
          </div>
        ))}
      </div>
      <button className="text-sm text-accent-ink mt-2 hover:underline" onClick={() => setRows((r) => [...r, emptyRow()])}>
        Add exercise
      </button>

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="label">All prescribed sets done?</span>
          <select className="input" value={allSets} onChange={(e) => setAllSets(e.target.value as "yes" | "no")}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="label">Could not complete</span>
          <input className="input" value={missed} onChange={(e) => setMissed(e.target.value)} placeholder="Last set of pull-ups" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="label">Felt easy</span>
          <input className="input" value={easy} onChange={(e) => setEasy(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="label">Felt hard</span>
          <input className="input" value={hard} onChange={(e) => setHard(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="label">Pain or discomfort</span>
          <input className="input" value={pain} onChange={(e) => setPain(e.target.value)} placeholder="None" />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="label">Anything else</span>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button className="btn btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={!rows.some((r) => r.name.trim())}>
          Send report
        </button>
      </div>
    </div>
  );
}
