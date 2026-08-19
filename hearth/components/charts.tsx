"use client";

import { useState } from "react";
import { fmtR, fmtR0 } from "@/lib/format";
import { cx } from "./ui";

/*
 * Chart conventions (kept deliberately minimal):
 * - Single-series marks use --series-1; the two-person comparison uses
 *   --series-1 (you) and --series-2 (KB). Both pairs pass CVD + contrast
 *   validation on light and dark surfaces.
 * - Thin marks, 4px rounded data ends, 2px gaps between adjacent fills.
 * - Text always wears ink/muted tokens, never the series color.
 */

export function BarList({
  rows,
  max,
}: {
  rows: Array<{ label: string; value: number; sub?: string }>;
  max?: number;
}) {
  const top = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} title={`${r.label}: ${fmtR(r.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink">{r.label}</span>
            <span className="text-sm font-medium tabular-nums text-ink">
              {fmtR(r.value)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-2">
            <div
              className="h-1.5 rounded-full bg-series-1"
              style={{ width: `${Math.max(1.5, (r.value / top) * 100)}%` }}
            />
          </div>
          {r.sub ? <div className="mt-0.5 text-xs text-muted">{r.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function PairLegend({ names }: { names: [string, string] }) {
  return (
    <div className="flex items-center gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-series-1" /> {names[0]}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-series-2" /> {names[1]}
      </span>
    </div>
  );
}

/** Two-person comparison rows (you vs KB) with a legend. */
export function PairBars({
  rows,
  names,
}: {
  rows: Array<{ label: string; a: number; b: number }>;
  names: [string, string];
}) {
  const top = Math.max(...rows.flatMap((r) => [r.a, r.b]), 1);
  return (
    <div>
      <div className="mb-3">
        <PairLegend names={names} />
      </div>
      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 text-sm text-ink">{r.label}</div>
            <div className="space-y-0.5">
              {[
                { v: r.a, cls: "bg-series-1", n: names[0] },
                { v: r.b, cls: "bg-series-2", n: names[1] },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2" title={`${s.n}: ${fmtR(s.v)}`}>
                  <div className="h-1.5 flex-1 rounded-full bg-surface-2">
                    <div
                      className={cx("h-1.5 rounded-full", s.cls)}
                      style={{ width: `${Math.max(1, (s.v / top) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right text-xs tabular-nums text-muted">
                    {fmtR0(s.v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Monthly columns, single series, with a hover tooltip and the last value labeled. */
export function Columns({
  points,
  height = 120,
  format = fmtR0,
}: {
  points: Array<{ label: string; value: number }>;
  height?: number;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {points.map((p, i) => (
          <div
            key={p.label}
            className="group relative flex h-full flex-1 flex-col justify-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {hover === i && (
              <div className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-ink shadow-sm">
                {format(p.value)}
              </div>
            )}
            <div
              className={cx(
                "w-full rounded-t bg-series-1 transition-opacity",
                hover !== null && hover !== i && "opacity-40",
              )}
              style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {points.map((p) => (
          <div key={p.label} className="flex-1 truncate text-center text-[11px] text-muted">
            {p.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Simple line trend, 2px stroke, hover markers with tooltips. */
export function TrendLine({
  points,
  height = 110,
  format = fmtR0,
}: {
  points: Array<{ label: string; value: number }>;
  height?: number;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) {
    return <p className="text-sm text-muted">Not enough months of data yet.</p>;
  }
  const w = 100;
  const h = 40;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * (w - 6) + 3;
  const y = (v: number) => h - 4 - ((v - min) / range) * (h - 8);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
  return (
    <div>
      <div className="relative" style={{ height }}>
        {hover !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-ink shadow-sm"
            style={{ left: `${x(hover)}%`, top: `${(y(points[hover].value) / h) * 100}%` }}
          >
            {points[hover].label}: {format(points[hover].value)}
          </div>
        )}
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full">
          <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={0.8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 1.6 : 1.1}
              fill="var(--series-1)"
              stroke="var(--surface)"
              strokeWidth={0.6}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
