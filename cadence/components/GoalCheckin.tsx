"use client";

import { useState, useTransition } from "react";
import { checkinAction } from "@/app/actions";
import { IconCheck, IconPlus } from "./icons";

/** Compact daily check-in control: boolean → tick; numeric → +step / value entry. */
export function CheckinQuick({
  goalId, date, value, target, trackingType, unit,
}: {
  goalId: number; date: string; value: number; target: number;
  trackingType: string; unit: string;
}) {
  const [pending, start] = useTransition();
  const done = value >= target;
  const isBool = trackingType === "boolean";

  const set = (v: number) => start(() => checkinAction(goalId, date, v));

  if (isBool || target === 1) {
    return (
      <button
        onClick={() => set(done ? 0 : target)}
        disabled={pending}
        aria-label={done ? "Mark not done" : "Mark done"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
          done
            ? "check-pop border-transparent bg-accent text-white"
            : "border-line-2 text-ink-3 hover:border-accent hover:text-accent-ink"
        }`}
      >
        <IconCheck size={16} />
      </button>
    );
  }
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        onClick={() => set(Math.min(value + stepFor(trackingType, target), target * 3))}
        disabled={pending || done}
        aria-label="Log progress"
        className={`flex h-9 w-9 items-center justify-center rounded-full border ${
          done
            ? "check-pop border-transparent bg-accent text-white"
            : "border-line-2 text-ink-2 hover:border-accent hover:text-accent-ink"
        }`}
      >
        {done ? <IconCheck size={16} /> : <IconPlus size={15} />}
      </button>
      <span className="text-[10px] tabular-nums text-ink-3">
        {trim(value)}/{trim(target)}{unit && ` ${unit}`}
      </span>
    </div>
  );
}

/** Fuller check-in row used on the goal detail + goals list pages. */
export function CheckinRow({
  goalId, date, value, target, trackingType, unit, minimum,
}: {
  goalId: number; date: string; value: number; target: number;
  trackingType: string; unit: string; minimum: number;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<string>("");
  const done = value >= target;
  const set = (v: number) => start(() => checkinAction(goalId, date, v));

  if (trackingType === "boolean") {
    return (
      <button
        onClick={() => set(done ? 0 : 1)}
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium ${
          done
            ? "border-transparent bg-accent-soft text-accent-ink"
            : "border-line-2 text-ink-2 hover:border-accent"
        }`}
      >
        <IconCheck size={15} /> {done ? "Done" : "Mark done"}
      </button>
    );
  }

  const step = stepFor(trackingType, target);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button onClick={() => set(Math.max(0, value - step))} disabled={pending || value <= 0}
          className="h-8 w-8 rounded-lg border border-line-2 text-sm text-ink-2 hover:bg-surface-2 disabled:opacity-30">−</button>
        <span className={`min-w-[4.5rem] text-center text-sm font-semibold tabular-nums ${done ? "text-accent-ink" : ""}`}>
          {trim(value)} / {trim(target)}{unit && <span className="ml-1 text-xs font-normal text-ink-3">{unit}</span>}
        </span>
        <button onClick={() => set(value + step)} disabled={pending}
          className="h-8 w-8 rounded-lg border border-line-2 text-sm text-ink-2 hover:bg-surface-2">+</button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(draft);
          if (Number.isFinite(n) && n >= 0) { set(n); setDraft(""); }
        }}
        className="flex items-center gap-1"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          inputMode="decimal"
          placeholder="exact"
          className="!w-20 !py-1 text-center text-sm"
          aria-label="Exact value"
        />
      </form>
      {done ? (
        <span className="check-pop inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
          <IconCheck size={13} /> target met
        </span>
      ) : minimum > 0 && value >= minimum ? (
        <span className="text-xs text-warn">minimum met</span>
      ) : null}
    </div>
  );
}

function stepFor(trackingType: string, target: number): number {
  if (trackingType === "time") return target >= 120 ? 30 : 15;
  if (target >= 1000) return 100;
  if (target >= 100) return 10;
  return 1;
}
function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
