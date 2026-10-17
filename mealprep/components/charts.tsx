"use client";
import { useState } from "react";

/**
 * Small SVG chart kit. Follows the dataviz rules: one axis, thin marks, fixed
 * categorical order, text in text tokens, legend for ≥2 series, hover tooltips.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const INK = "#1f1f1d", INK2 = "#52514e", INK3 = "#8a8884", GRID = "#ece7df";

function fmt(n: number, unit?: string): string {
  const s = Math.abs(n) >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k" : Math.round(n * 10) / 10 + "";
  return unit === "R" ? "R" + s : unit === "%" ? s + "%" : s;
}

type Series = { name: string; values: number[] };

export function BarChart({ labels, series, height = 200, unit, stacked = false }: { labels: string[]; series: Series[]; height?: number; unit?: string; stacked?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 600, h = height, padL = 44, padB = 28, padT = 10, padR = 8;
  const n = labels.length;
  const maxV = Math.max(1, ...labels.map((_, i) => (stacked ? series.reduce((s, sr) => s + (sr.values[i] ?? 0), 0) : Math.max(...series.map((sr) => sr.values[i] ?? 0)))));
  const y = (v: number) => padT + (h - padT - padB) * (1 - v / maxV);
  const slot = (w - padL - padR) / Math.max(1, n);
  const barW = stacked ? slot * 0.55 : (slot * 0.7) / series.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxV);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 3} fontSize={10} fill={INK3} textAnchor="end">{fmt(t, unit)}</text>
          </g>
        ))}
        {labels.map((lab, i) => {
          let acc = 0;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={h - padT - padB} fill={hover === i ? "rgba(31,31,29,0.04)" : "transparent"} />
              {series.map((sr, si) => {
                const v = sr.values[i] ?? 0;
                if (stacked) {
                  const y0 = y(acc), y1 = y(acc + v); acc += v;
                  return <rect key={si} x={padL + i * slot + (slot - barW) / 2} y={y1} width={barW} height={Math.max(0, y0 - y1 - 2)} fill={SERIES[si]} rx={2} />;
                }
                const x = padL + i * slot + (slot - barW * series.length) / 2 + si * barW;
                return <rect key={si} x={x + 1} y={y(v)} width={Math.max(1, barW - 2)} height={Math.max(0, y(0) - y(v))} fill={SERIES[si]} rx={3} />;
              })}
              <text x={padL + i * slot + slot / 2} y={h - 8} fontSize={10} fill={INK2} textAnchor="middle">{lab}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="absolute top-1 right-1 bg-white border border-line rounded-lg px-2.5 py-1.5 text-xs shadow-sm pointer-events-none">
          <div className="font-medium text-ink">{labels[hover]}</div>
          {series.map((sr, si) => <div key={si} className="flex items-center gap-1.5 text-ink-2"><span className="w-2 h-2 rounded-full" style={{ background: SERIES[si] }} />{sr.name}: <b className="text-ink">{fmt(sr.values[hover] ?? 0, unit)}</b></div>)}
        </div>
      )}
      {series.length > 1 && <Legend series={series} />}
    </div>
  );
}

export function LineChart({ labels, series, height = 200, unit, yMin }: { labels: string[]; series: Series[]; height?: number; unit?: string; yMin?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 600, h = height, padL = 44, padB = 28, padT = 10, padR = 12;
  const n = labels.length;
  const all = series.flatMap((s) => s.values).filter((v) => v != null && !Number.isNaN(v));
  const maxV = Math.max(1, ...all) * 1.05;
  const minV = yMin ?? Math.min(0, ...all);
  const y = (v: number) => padT + (h - padT - padB) * (1 - (v - minV) / (maxV - minV || 1));
  const x = (i: number) => padL + (n <= 1 ? 0 : ((w - padL - padR) * i) / (n - 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => minV + t * (maxV - minV));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = (e.target as SVGElement).closest("svg")!.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * w; const i = Math.round(((px - padL) / (w - padL - padR)) * (n - 1)); setHover(Math.max(0, Math.min(n - 1, i))); }}>
        {ticks.map((t) => <g key={t}><line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={GRID} /><text x={padL - 6} y={y(t) + 3} fontSize={10} fill={INK3} textAnchor="end">{fmt(t, unit)}</text></g>)}
        {series.map((sr, si) => {
          const pts = sr.values.map((v, i) => (v == null || Number.isNaN(v) ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ");
          return <g key={si}><polyline points={pts} fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" />{sr.values.map((v, i) => (v == null || Number.isNaN(v) ? null : <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 3} fill={SERIES[si]} stroke="#fff" strokeWidth={2} />))}</g>;
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={h - padB} stroke={INK3} strokeDasharray="3 3" />}
        {labels.map((lab, i) => (n > 12 && i % Math.ceil(n / 12) !== 0 ? null : <text key={i} x={x(i)} y={h - 8} fontSize={10} fill={INK2} textAnchor="middle">{lab}</text>))}
      </svg>
      {hover != null && (
        <div className="absolute top-1 right-1 bg-white border border-line rounded-lg px-2.5 py-1.5 text-xs shadow-sm pointer-events-none">
          <div className="font-medium text-ink">{labels[hover]}</div>
          {series.map((sr, si) => <div key={si} className="flex items-center gap-1.5 text-ink-2"><span className="w-2 h-2 rounded-full" style={{ background: SERIES[si] }} />{sr.name}: <b className="text-ink">{sr.values[hover] == null ? "—" : fmt(sr.values[hover], unit)}</b></div>)}
        </div>
      )}
      {series.length > 1 && <Legend series={series} />}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  return <div className="flex flex-wrap gap-3 mt-2 text-xs text-ink-2">{series.map((s, i) => <span key={i} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[i] }} />{s.name}</span>)}</div>;
}

export function Donut({ parts, size = 120, label }: { parts: { name: string; value: number }[]; size?: number; label?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const r = 42, c = 2 * Math.PI * r;
  const offsets = parts.reduce<number[]>((arr, p) => [...arr, (arr[arr.length - 1] ?? 0) + (p.value / total) * c], [0]);
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img">
        <circle cx={50} cy={50} r={r} fill="none" stroke={GRID} strokeWidth={10} />
        {parts.map((p, i) => { const len = (p.value / total) * c; return <circle key={i} cx={50} cy={50} r={r} fill="none" stroke={SERIES[i]} strokeWidth={10} strokeDasharray={`${Math.max(0, len - 2)} ${c - len + 2}`} strokeDashoffset={-offsets[i]} transform="rotate(-90 50 50)" />; })}
        {label && <text x={50} y={54} textAnchor="middle" fontSize={12} fill={INK} fontWeight={600}>{label}</text>}
      </svg>
      <div className="text-xs space-y-1">{parts.map((p, i) => <div key={i} className="flex items-center gap-1.5 text-ink-2"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES[i] }} />{p.name} <b className="text-ink ml-1">{Math.round((p.value / total) * 100)}%</b></div>)}</div>
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 32, color = SERIES[0] }: { values: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - ((v - min) / (max - min || 1)) * (height - 4) - 2}`).join(" ");
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} /></svg>;
}

export function Ring({ value, max, label, size = 72, color = SERIES[0] }: { value: number; max: number; label: string; size?: number; color?: string }) {
  const r = 30, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 72 72" width={size} height={size}>
        <circle cx={36} cy={36} r={r} fill="none" stroke={GRID} strokeWidth={6} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6} strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
        <text x={36} y={40} textAnchor="middle" fontSize={13} fill={INK} fontWeight={600}>{Math.round(pct * 100)}%</text>
      </svg>
      <div className="text-[11px] text-ink-2 mt-1">{label}</div>
    </div>
  );
}
