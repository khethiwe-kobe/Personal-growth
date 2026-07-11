"use client";

// Chart components. Single-series warm-brown sequential encoding throughout —
// identity is carried by titles and direct labels, values by position/length.
// Ramp (light to dark): #f4efe6 #e9dfd0 #d6c3a8 #bda183 #9c7b5c #7c5f44 #5d4633

import { useState } from "react";

export function ProgressRing({
  value,
  label,
  sublabel,
  size = 108,
}: {
  value: number; // 0..1
  label: string;
  sublabel?: string;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} role="img" aria-label={`${label}: ${Math.round(pct * 100)}%`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0e9dc" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#7c5f44"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-ink"
          style={{ fontFamily: "Georgia, serif", fontSize: size / 4.5 }}
        >
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div className="text-center">
        <p className="text-sm text-ink">{label}</p>
        {sublabel && <p className="text-xs text-faint">{sublabel}</p>}
      </div>
    </div>
  );
}

const RAMP = ["#f4efe6", "#e9dfd0", "#d6c3a8", "#bda183", "#9c7b5c", "#7c5f44", "#5d4633"];

export function rampColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return RAMP[0];
  const idx = Math.min(RAMP.length - 1, 1 + Math.floor((value / max) * (RAMP.length - 2)));
  return RAMP[idx];
}

/** Month heat map: one cell per day, sequential brown by count. */
export function MonthHeatmap({
  days,
  counts,
  max,
}: {
  days: string[]; // ISO dates of the month, in order
  counts: Record<string, number>;
  max: number;
}) {
  const firstDow = days.length ? (new Date(days[0] + "T00:00").getDay() + 6) % 7 : 0;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-faint">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => (
          <span key={`pad${i}`} />
        ))}
        {days.map((d) => {
          const n = counts[d] || 0;
          return (
            <span
              key={d}
              title={`${d} — ${n}`}
              className="aspect-square rounded-md border border-line-soft"
              style={{ background: rampColor(n, max) }}
            />
          );
        })}
      </div>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
}

/** Thin vertical bars with rounded data-ends, hover tooltip, direct label on hover. */
export function BarChart({ data, height = 140, unit = "" }: { data: BarDatum[]; height?: number; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.max(4, (d.value / max) * (height - 24));
          return (
            <div
              key={i}
              className="group relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {hover === i && (
                <span className="absolute -top-1 z-10 whitespace-nowrap rounded-lg border border-line bg-card px-2 py-0.5 text-xs text-ink">
                  {d.value}
                  {unit} {d.hint ? `· ${d.hint}` : ""}
                </span>
              )}
              <div
                className="w-full max-w-7 rounded-t-md transition-colors"
                style={{ height: h, background: hover === i ? "#5d4633" : "#9c7b5c" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2 border-t border-line pt-1">
        {data.map((d, i) => (
          <span key={i} className="flex-1 truncate text-center text-[10px] text-faint">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Simple line chart for a numeric series over time (e.g. weight). */
export function LineChart({
  points,
  height = 160,
  unit = "",
}: {
  points: { label: string; value: number }[];
  height?: number;
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const w = 100;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => 8 + (1 - (v - min) / span) * 84;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <div>
      <svg viewBox={`0 0 ${w} 100`} style={{ height, width: "100%" }} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="#7c5f44" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.value)}
            r={hover === i ? 2.4 : 1.4}
            fill={hover === i ? "#5d4633" : "#9c7b5c"}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{`${p.label}: ${p.value}${unit}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-faint">
        <span>{points[0].label}</span>
        <span className="text-soft">
          {hover !== null ? `${points[hover].label}: ${points[hover].value}${unit}` : `latest ${last.value}${unit}`}
        </span>
        <span>{last.label}</span>
      </div>
    </div>
  );
}
