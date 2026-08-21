import type { TaskRow, TimeBlockRow, CategoryRow } from "@/lib/types";
import { unaccountedGaps, ACCOUNT_START, ACCOUNT_END } from "@/lib/analytics";
import { fmtClock, fmtMinutes } from "@/lib/time";
import { deleteBlockAction } from "@/app/actions";
import { IconCheck } from "./icons";

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

  /**
   * Two columns: what you planned, and what actually happened.
   *
   * Planned holds every scheduled task. Actual holds the time you logged plus
   * the tasks you completed — so a faded bar on the left with nothing beside
   * it is a plan you missed, and a bar on the right with nothing on the left
   * is time you spent on something you never planned. Drawing both in one
   * column meant a task and a block at the same hour sat on top of each other.
   */
  type Item =
    | { kind: "task"; start: number; end: number; task: TaskRow }
    | { kind: "block"; start: number; end: number; block: TimeBlockRow };

  // A task you ticked but never logged time against has nothing to sit
  // opposite it, so it spans both columns rather than leaving the Actual side
  // blank — the tick is the only record there is.
  const coveredByLog = (from: number, to: number) =>
    blocks.some((b) => b.start_min < to && from < b.end_min);
  const plannedItems: (Item & { full?: boolean })[] = scheduled.map((t) => ({
    kind: "task" as const,
    start: t.start_min!,
    end: t.end_min!,
    task: t,
    full: !!t.completed && !coveredByLog(t.start_min!, t.end_min!),
  }));
  // Actual is what you logged, and only that — a tick is a claim, a logged
  // block is a record. Completed tasks are marked on the planned side instead
  // of being copied across, so the two columns answer different questions:
  // what did I intend, and what did I actually put time into.
  const actualItems: Item[] = blocks.map((b) => ({
    kind: "block" as const, start: b.start_min, end: b.end_min, block: b,
  }));

  /** Side-by-side lanes so overlapping items within a column never stack. */
  const laneOut = (list: Item[]) => {
    const sorted = [...list].sort((a, b) => a.start - b.start || b.end - a.end);
    const ends: number[] = [];
    const placed = sorted.map((it) => {
      let lane = ends.findIndex((busyUntil) => busyUntil <= it.start);
      if (lane === -1) { lane = ends.length; ends.push(0); }
      ends[lane] = it.end;
      return { ...it, lane, nextStart: endBound };
    });
    // Short items are given a minimum height so their label fits, which would
    // otherwise push them over whatever starts immediately afterwards. Record
    // where the next item in the same lane begins so the growth can be capped.
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (placed[j].lane === placed[i].lane) {
          placed[i].nextStart = placed[j].start;
          break;
        }
      }
    }
    return { placed, lanes: Math.max(ends.length, 1) };
  };
  const columns = [
    { key: "planned" as const, ...laneOut(plannedItems) },
    { key: "actual" as const, ...laneOut(actualItems) },
  ];

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
      <div className="mb-1 flex text-[10px] font-medium uppercase tracking-[0.1em] text-ink-3">
        <span className="w-[3.25rem] shrink-0" />
        <span className="flex-1 items-center gap-1">
          Planned
          <span className="ml-1 inline-flex items-center gap-0.5 normal-case text-ink-3">
            · <IconCheck size={10} className="text-ok" /> done
          </span>
        </span>
        <span className="flex-1 border-l border-line pl-2">
          Actual <span className="normal-case text-ink-3">· logged</span>
        </span>
      </div>
      <div className="relative" style={{ height }}>
        {/* divider between the two columns */}
        <div
          className="pointer-events-none absolute top-0 w-px bg-line"
          style={{ left: "calc(3.25rem + (100% - 3.25rem) / 2)", height }}
        />
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
        {/* items, per column */}
        {columns.flatMap((col, colIndex) =>
          col.placed.map((it) => {
            const laneW = 1 / col.lanes;
            // Spanning items ignore the column split and take the full track.
            const full = "full" in it && it.full === true;
            const rawHeight = y(it.end) - y(it.start) - 2;
            // A 20-minute block is ~14px at this scale, but padding plus one
            // 11px line needs ~26px — anything less clipped its own label.
            // Never grow past whatever starts next in this lane, though.
            const room = y(it.nextStart) - y(it.start) - 2;
            const height = Math.min(Math.max(rawHeight, 26), Math.max(room, rawHeight));
            // Below this there is not enough room for a legible line, so the
            // bar carries its colour and its tooltip and no text at all —
            // better than a row of letters sliced through the middle.
            const noText = height < 20;
            // Only one line fits: keep it on one row and truncate.
            const tight = height < 36;
            // Half the track each, offset by which column this is.
            const colFrac = (colIndex + it.lane * laneW) / 2;
            const common = (
              full
                ? {
                    top: y(it.start) + 1,
                    height,
                    left: "calc(3.25rem + 2px)",
                    width: "calc(100% - 3.25rem - 6px)",
                  }
                : {
                    top: y(it.start) + 1,
                    height,
                    left: `calc(3.25rem + (100% - 3.25rem) * ${colFrac} + 2px)`,
                    width: `calc((100% - 3.25rem) * ${laneW / 2} - 6px)`,
                  }
            ) as React.CSSProperties;

            if (it.kind === "task") {
              const cat = it.task.category_id ? catMap.get(it.task.category_id) : undefined;
              const color = cat?.color ?? "#b8b8b0";
              const done = !!it.task.completed;
              const overdue = !done && nowMin !== null && it.end < nowMin;
              // An unfinished plan recedes; a completed one is solid and ticked.
              const faded = !done;
              return (
                <div
                  key={`${col.key}-t-${it.task.id}`}
                  className={`absolute flex flex-col justify-center overflow-hidden rounded-lg border px-2 text-[11px] leading-tight ${
                    tight ? "py-0" : "py-1"
                  } ${faded ? "opacity-60" : ""}`}
                  style={{
                    ...common,
                    background: `color-mix(in oklab, ${color} 26%, var(--surface))`,
                    borderColor: `color-mix(in oklab, ${color} 45%, var(--line))`,
                  }}
                  title={`${it.task.name} · ${fmtClock(it.start)}–${fmtClock(it.end)}${
                    col.key === "actual" ? " · completed" : ""
                  }`}
                >
                  {!noText && (
                    <div className="flex min-w-0 items-baseline gap-1">
                      {done && (
                        <IconCheck size={10} className="shrink-0 text-ok" aria-label="completed" />
                      )}
                      <span className="min-w-0 truncate font-medium">{it.task.name}</span>
                      {!tight && (
                        <span className="shrink-0 text-ink-3">
                          {fmtClock(it.start)}–{fmtClock(it.end)}
                        </span>
                      )}
                    </div>
                  )}
                  {!tight && overdue && <span className="font-medium text-danger">overdue</span>}
                </div>
              );
            }
            return (
              <form
                key={`${col.key}-b-${it.block.id}`}
                action={deleteBlockAction}
                className={`group absolute flex flex-col justify-center overflow-hidden rounded-lg border px-2 text-[11px] leading-tight ${
                  tight ? "py-0" : "py-1"
                } ${KIND_CLASS[it.block.kind] ?? "border-line bg-surface-2 text-ink-2"}`}
                style={common}
                title={`${KIND_LABEL[it.block.kind] ?? it.block.kind} · ${fmtClock(it.start)}–${fmtClock(it.end)}`}
              >
                <input type="hidden" name="id" value={it.block.id} />
                {!noText && (
                  <div className="flex min-w-0 items-baseline gap-1">
                    <span className="min-w-0 truncate font-medium">
                      {it.block.label || KIND_LABEL[it.block.kind] || it.block.kind}
                    </span>
                    {!tight && (
                      <span className="shrink-0 text-ink-3">
                        {fmtClock(it.start)}–{fmtClock(it.end)}
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  aria-label="Remove block"
                  className="touch-reveal absolute right-1 top-1 hidden rounded p-0.5 text-ink-3 hover:text-danger group-hover:block"
                >
                  ×
                </button>
              </form>
            );
          })
        )}
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
