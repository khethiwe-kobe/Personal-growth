"use client";

import { useMemo } from "react";
import { groupMetrics, lowerIsBetter } from "@/lib/metrics";
import type { Metric } from "@/lib/types";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="text-accent">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.2" fill="currentColor" />
    </svg>
  );
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Baseline, latest and change for each tracked test. */
export function MetricsTable({ metrics }: { metrics: Metric[] }) {
  const groups = useMemo(() => groupMetrics(metrics), [metrics]);
  return (
        <section className="card overflow-hidden mb-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>Test</th>
              <th className="text-right">Baseline</th>
              <th className="text-right">Latest</th>
              <th className="text-right">Change</th>
              <th className="hidden sm:table-cell">Trend</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const first = g[0];
              const last = g[g.length - 1];
              const delta = last.value - first.value;
              const pct = first.value !== 0 ? (delta / Math.abs(first.value)) * 100 : 0;
              const improved = lowerIsBetter(last) ? delta < 0 : delta > 0;
              const tone = delta === 0 || g.length < 2 ? "text-ink-3" : improved ? "text-ok" : "text-danger";
              return (
                <tr key={first.key}>
                  <td>
                    <div className="font-medium">{last.label}</div>
                    <div className="text-xs text-ink-3">
                      {g.length} reading{g.length === 1 ? "" : "s"}
                      {last.note ? ` · ${last.note}` : ""}
                    </div>
                  </td>
                  <td className="text-right text-ink-2 whitespace-nowrap">
                    {fmt(first.value)} {first.unit}
                    <div className="text-xs text-ink-3">{first.date}</div>
                  </td>
                  <td className="text-right whitespace-nowrap font-medium">
                    {fmt(last.value)} {last.unit}
                    <div className="text-xs text-ink-3 font-normal">{last.date}</div>
                  </td>
                  <td className={`text-right whitespace-nowrap ${tone}`}>
                    {g.length > 1 ? `${delta > 0 ? "+" : ""}${fmt(delta)} (${pct > 0 ? "+" : ""}${pct.toFixed(0)}%)` : "–"}
                  </td>
                  <td className="hidden sm:table-cell">
                    <Sparkline values={g.map((m) => m.value)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
  );
}
