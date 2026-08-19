/**
 * Small hand-rolled SVG charts. One series = no legend (title names it);
 * two series get a legend; category bars are direct-labeled so pastel
 * entity colors never have to carry identity alone.
 */

export function Sparkline({
  values, width = 120, height = 36, color = "var(--accent)",
}: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (width - 4) + 2,
    height - 3 - ((v - min) / range) * (height - 6),
  ]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LineChart({
  points, height = 180, yMax, unit = "", title,
}: {
  points: { label: string; value: number }[];
  height?: number; yMax?: number; unit?: string; title: string;
}) {
  const W = 640, H = height, PAD_L = 34, PAD_B = 22, PAD_T = 10, PAD_R = 10;
  const max = yMax ?? Math.max(...points.map((p) => p.value), 1);
  const iw = W - PAD_L - PAD_R, ih = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (points.length < 2 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD_T + ih - (Math.min(v, max) / max) * ih;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const step = Math.max(1, Math.ceil(points.length / 8));
  return (
    <figure role="img" aria-label={title}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)}
              stroke="var(--line)" strokeWidth="1" />
            <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" fontSize="9"
              fill="var(--ink-3)">{v}{unit}</text>
          </g>
        ))}
        {points.length > 1 && (
          <path d={`${d} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`}
            fill="var(--accent)" opacity="0.08" />
        )}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.value)} r="8" fill="transparent">
              <title>{`${p.label}: ${p.value}${unit}`}</title>
            </circle>
            {(i % step === 0 || i === points.length - 1) && (
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--ink-3)">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}

/** Horizontal category bars, direct-labeled (name + value). */
export function CategoryBars({
  rows, unit = "m", formatValue,
}: {
  rows: { label: string; value: number; color: string; secondary?: number }[];
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => Math.max(r.value, r.secondary ?? 0)), 1);
  const fmt = formatValue ?? ((v: number) => `${Math.round(v)}${unit}`);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />
              {r.label}
            </span>
            <span className="tabular-nums text-ink-3">
              {r.secondary !== undefined ? `${fmt(r.secondary)} / ` : ""}{fmt(r.value)}
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full" style={{ background: "var(--ring-track)" }}>
            <div className="absolute inset-y-0 left-0 rounded-full opacity-40"
              style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
            {r.secondary !== undefined && (
              <div className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(r.secondary / max) * 100}%`, background: r.color }} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Vertical paired bars: planned vs completed per day. Two series → legend. */
export function PairedBars({
  data, title, unit = "h",
}: {
  data: { label: string; planned: number; actual: number }[];
  title: string; unit?: string;
}) {
  const W = 640, H = 190, PAD_L = 30, PAD_B = 22, PAD_T = 14, PAD_R = 6;
  const max = Math.max(...data.flatMap((d) => [d.planned, d.actual]), 1);
  const iw = W - PAD_L - PAD_R, ih = H - PAD_T - PAD_B;
  const groupW = iw / Math.max(data.length, 1);
  const barW = Math.min(14, groupW * 0.32);
  const y = (v: number) => PAD_T + ih - (v / max) * ih;
  return (
    <figure role="img" aria-label={title}>
      <div className="mb-2 flex items-center gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--ring-track)", border: "1px solid var(--line-2)" }} />
          Planned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--accent)" }} />
          Completed
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.5, 1].map((f, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" />
            <text x={PAD_L - 5} y={y(max * f) + 3} textAnchor="end" fontSize="9" fill="var(--ink-3)">
              {Math.round(max * f * 10) / 10}{unit}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD_L + groupW * i + groupW / 2;
          return (
            <g key={i}>
              <rect x={cx - barW - 1} width={barW} y={y(d.planned)}
                height={Math.max(0, PAD_T + ih - y(d.planned))} rx="3"
                fill="var(--ring-track)" stroke="var(--line-2)" strokeWidth="0.5">
                <title>{`${d.label} planned: ${d.planned}${unit}`}</title>
              </rect>
              <rect x={cx + 1} width={barW} y={y(d.actual)}
                height={Math.max(0, PAD_T + ih - y(d.actual))} rx="3" fill="var(--accent)">
                <title>{`${d.label} completed: ${d.actual}${unit}`}</title>
              </rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--ink-3)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
