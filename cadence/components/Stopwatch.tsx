"use client";

import { useEffect, useRef, useState } from "react";
import { logTrackedTimeAction } from "@/app/actions";
import { Button, Card } from "./ui";
import { useRouter } from "next/navigation";

const KINDS: [string, string][] = [
  ["focus", "Focused work"], ["personal", "Personal"], ["social", "Social"],
  ["travel", "Travel"], ["break", "Break"], ["rest", "Rest"],
  ["sleep", "Sleep"], ["unplanned", "Unplanned"], ["other", "Other"],
];

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const minsOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

function elapsedLabel(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Count-up timer for time you didn't plan in advance. Say what you're doing,
 * start it, and when you stop, the real elapsed time is written onto today's
 * timeline — so the hour is accounted for instead of showing up as a gap.
 */
export default function Stopwatch() {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("focus");
  const [countAsFocus, setCountAsFocus] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  // A stopwatch is a claim about your real day, so warn before losing one.
  useEffect(() => {
    if (!startedAt) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [startedAt]);

  const seconds = startedAt ? Math.max(0, Math.floor((now - startedAt.getTime()) / 1000)) : 0;

  const start = () => {
    setSaved(null);
    setStartedAt(new Date());
    setNow(Date.now());
  };

  const stop = async () => {
    if (!startedAt || saving) return;
    const ended = new Date();
    const startMin = minsOf(startedAt);
    const endMin = Math.max(startMin + 1, minsOf(ended));
    setSaving(true);
    setError(null);
    try {
      await logTrackedTimeAction({
        label: label.trim() || KINDS.find((k) => k[0] === kind)?.[1] || "Tracked",
        kind, startMin, endMin, countAsFocus: countAsFocus && kind === "focus",
      });
      setSaved(`${hhmm(startedAt)}–${hhmm(ended)} logged to today`);
      setStartedAt(null);
      setLabel("");
      router.refresh();
    } catch {
      // Keep the stopwatch running so the elapsed time isn't lost — the user
      // can reload and stop it again rather than losing the record.
      setError(
        `Couldn't save it — the server call failed. Your ${hhmm(startedAt)} start is ` +
          "still running, so reload the page (Ctrl+Shift+R) and stop it again."
      );
    } finally {
      setSaving(false);
    }
  };

  const discard = () => { setStartedAt(null); setSaved(null); };

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-medium">Track what you&apos;re doing</h3>
        <span className="text-[11px] text-ink-3">logs straight onto today&apos;s timeline</span>
      </div>

      {startedAt ? (
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-3">
            {label.trim() || KINDS.find((k) => k[0] === kind)?.[1]}
          </p>
          <p className="my-3 font-display text-5xl font-medium tabular-nums">{elapsedLabel(seconds)}</p>
          <p className="mb-4 text-xs text-ink-3">started {hhmm(startedAt)}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" onClick={stop} disabled={saving}>
              {saving ? "Saving…" : "Stop & log it"}
            </Button>
            <Button variant="ghost" type="button" onClick={discard} disabled={saving}>
              Discard
            </Button>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-left text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="sw-label">
              What are you busy with?
            </label>
            <input
              id="sw-label" ref={labelRef} value={label} maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Marking scripts, Gym, Drive to campus"
              onKeyDown={(e) => { if (e.key === "Enter") start(); }}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[9rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-ink-2" htmlFor="sw-kind">
                Counts as
              </label>
              <select id="sw-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <Button type="button" onClick={start}>Start stopwatch</Button>
          </div>
          {kind === "focus" && (
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={countAsFocus}
                onChange={(e) => setCountAsFocus(e.target.checked)} />
              Also count it towards my focus hours
            </label>
          )}
          {saved && <p className="text-xs text-ok">{saved}</p>}
        </div>
      )}
    </Card>
  );
}
