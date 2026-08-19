import type { TaskRow, TimeBlockRow, CategoryRow } from "@/lib/types";
import { unaccountedGaps, ACCOUNT_START, ACCOUNT_END } from "@/lib/analytics";
import { fmtClock, fmtMinutes } from "@/lib/time";
import { deleteBlockAction } from "@/app/actions";

const KIND_LABEL: Record<string, string> = {
  focus: "Focused work", break: "Break", rest: "Rest", travel: "Travel",
  social: "Social", personal: "Personal", unplanned: "Unplanned",
  other: "Other", sleep: "Sleep",
};

// Tracked work reads as productive; sleep recedes; everything else is neutral.
const KIND_CLASS: Record<string, string> = {
  focus: "border-transparent bg-accent-soft text-accent-ink",
  sleep: "border-line bg-surface-2 text-ink-3",
};

/**
 * The full 24-hour day, midnight to midnight — every hour is accountable,
 * sleep included.
 * Tasks are colored by category; intentional blocks are muted; gaps between
 * the accounting bounds are explicitly labeled "unaccounted".
 */
export default function Timeline({
  tasks, blocks, categories, nowMin,
}: {
  tasks: TaskRow[];
  blocks: TimeBlockRow[];
  categories: CategoryRow[];
  nowMin: number | null;
}) {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const scheduled = tasks.filter((t) => t.start_min !== null && t.end_min !== null);

  const startBound = ACCOUNT_START;
  const endBound = ACCOUNT_END;
  const span = endBound - startBound;
  // A full day at the old scale would be ~1500px; this keeps it readable
  // without turning the page into an endless scroll.
  const PX_PER_MIN = 0.72;
  const height = span * PX_PER_MIN;
  const y = (min: number) => (min - startBound) * PX_PER_MIN;

  const gaps = unaccountedGaps([
    ...scheduled.map((t) => ({ start: t.start_min as number, end: t.end_min as number })),
    ...blocks.map((b) => ({ start: b.start_min, end: b.end_min })),
  ]);
  const totalGap = gaps.reduce((s, g) => s + (g.end - g.start), 0);

  // simple lane layout for overlapping items
  type Item =
    | { kind: "task"; start: number; end: number; task: TaskRow }
    | { kind: "block"; start: number; end: number; block: TimeBlockRow };
  const items: Item[] = [
    ...scheduled.map((t) => ({ kind: "task" as const, start: t.start_min!, end: t.end_min!, task: t })),
    ...blocks.map((b) => ({ kind: "block" as const, start: b.start_min, end: b.end_min, block: b })),
  ].sort((a, b) => a.start - b.start || b.end - a.end);
  const lanes: number[] = [];
  const placed = items.map((it) => {
    let lane = lanes.findIndex((busyUntil) => busyUntil <= it.start);
    if (lane === -1) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = it.end;
    return { ...it, lane };
  });
  const laneCount = Math.max(lanes.length, 1);

  const hours: number[] = [];
  for (let h = Math.ceil(startBound / 60); h * 60 <= endBound; h++) hours.push(h);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-ink-3">
          {fmtClock(startBound)} – {endBound >= 24 * 60 ? "24:00" : fmtClock(endBound)}
        </span>
        <span className={totalGap > 0 ? "font-medium text-warn" : "font-medium text-ok"}>
          {totalGap > 0 ? `${fmtMinutes(totalGap)} unaccounted across the day` : "Every hour accounted for"}
        </span>
      </div>
      <div className="relative" style={{ height }}>
        {/* hour grid */}
        {hours.map((h) => (
          <div key={h} className="absolute inset-x-0" style={{ top: y(h * 60) }}>
            <div className="flex items-center gap-2">
              <span className="w-10 text-right text-[10px] tabular-nums text-ink-3">
                {String(h).padStart(2, "0")}:00
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>
          </div>
        ))}
        {/* unaccounted gaps */}
        {gaps.map((g, i) => (
          <div
            key={`gap-${i}`}
            className="absolute right-0 flex items-center justify-center rounded-lg border border-dashed border-warn/40 text-[10px] font-medium text-warn"
            style={{
              top: y(g.start) + 1, height: Math.max(y(g.end) - y(g.start) - 2, 12),
              left: "3.25rem",
              background: "color-mix(in oklab, var(--warn) 5%, transparent)",
            }}
          >
            {g.end - g.start >= 25 && `${fmtMinutes(g.end - g.start)} unaccounted`}
          </div>
        ))}
        {/* items */}
        {placed.map((it) => {
          const widthPct = 100 / laneCount;
          const common = {
            top: y(it.start) + 1,
            height: Math.max(y(it.end) - y(it.start) - 2, 14),
            left: `calc(3.25rem + (100% - 3.25rem) * ${it.lane / laneCount})`,
            width: `calc((100% - 3.25rem) * ${widthPct / 100} - 4px)`,
          } as React.CSSProperties;
          if (it.kind === "task") {
            const cat = it.task.category_id ? catMap.get(it.task.category_id) : undefined;
            const color = cat?.color ?? "#b8b8b0";
            const done = !!it.task.completed;
            const overdue = !done && nowMin !== null && it.end < nowMin;
            return (
              <div
                key={`t-${it.task.id}`}
                className={`absolute overflow-hidden rounded-lg border px-2 py-1 text-[11px] leading-tight ${done ? "opacity-55" : ""}`}
                style={{
                  ...common,
                  background: `color-mix(in oklab, ${color} 26%, var(--surface))`,
                  borderColor: `color-mix(in oklab, ${color} 45%, var(--line))`,
                }}
                title={`${it.task.name} · ${fmtClock(it.start)}–${fmtClock(it.end)}`}
              >
                <span className={`font-medium ${done ? "line-through" : ""}`}>{it.task.name}</span>
                <span className="ml-1 text-ink-3">{fmtClock(it.start)}–{fmtClock(it.end)}</span>
                {overdue && <span className="ml-1 font-medium text-danger">overdue</span>}
                {done && <span className="ml-1 text-ok">done</span>}
              </div>
            );
          }
          return (
            <form
              key={`b-${it.block.id}`}
              action={deleteBlockAction}
              className={`group absolute overflow-hidden rounded-lg border px-2 py-1 text-[11px] leading-tight ${
                KIND_CLASS[it.block.kind] ?? "border-line bg-surface-2 text-ink-2"
              }`}
              style={common}
              title={`${KIND_LABEL[it.block.kind] ?? it.block.kind} · ${fmtClock(it.start)}–${fmtClock(it.end)}`}
            >
              <input type="hidden" name="id" value={it.block.id} />
              <span className="font-medium">{it.block.label || KIND_LABEL[it.block.kind] || it.block.kind}</span>
              <span className="ml-1 text-ink-3">{fmtClock(it.start)}–{fmtClock(it.end)}</span>
              <button
                type="submit"
                aria-label="Remove block"
                className="absolute right-1 top-1 hidden rounded p-0.5 text-ink-3 hover:text-danger group-hover:block"
              >
                ×
              </button>
            </form>
          );
        })}
        {/* now line */}
        {nowMin !== null && nowMin >= startBound && nowMin <= endBound && (
          <div className="pointer-events-none absolute inset-x-0" style={{ top: y(nowMin) }}>
            <div className="ml-[3.25rem] h-[2px] rounded bg-danger/70" />
          </div>
        )}
      </div>
    </div>
  );
}
