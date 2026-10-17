"use client";
import Link from "next/link";
import { useState } from "react";

/** "Do you deliver to me?" — matches the visitor's suburb against the configured delivery areas. */
export default function AreaChecker({ areas }: { areas: string[] }) {
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<string | null>(null);
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z]/g, "");
  const match = checked ? areas.find((a) => norm(a).includes(norm(checked)) || norm(checked).includes(norm(a))) : undefined;
  return (
    <form className="card p-6" onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 3) setChecked(q.trim()); }}>
      <label className="block">
        <span className="text-lg font-display">Do we deliver to you?</span>
        <div className="mt-3 flex gap-2">
          <input value={q} onChange={(e) => { setQ(e.target.value); setChecked(null); }} placeholder="Your suburb, e.g. Rosebank" className="input" autoComplete="address-level3" />
          <button className="btn-primary shrink-0">Check</button>
        </div>
      </label>
      {checked && (
        <p className="mt-4 text-sm" role="status">
          {match
            ? <><b className="text-good">Yes — we deliver to {match}.</b> <Link href="/onboard" className="text-accent font-medium">Build your plan →</Link></>
            : <>We don&apos;t deliver to <b>{checked}</b> yet. <Link href={`/contact?suburb=${encodeURIComponent(checked)}`} className="text-accent font-medium">Join the waitlist →</Link></>}
        </p>
      )}
    </form>
  );
}
