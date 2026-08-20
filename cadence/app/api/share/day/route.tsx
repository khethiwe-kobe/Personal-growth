import { ImageResponse } from "next/og";
import { requireUser } from "@/lib/auth";
import { tasksForDay, blocksForDay, categoriesFor, daySummaryFor } from "@/lib/repo";
import { todayInTz, fmtClock, fmtMinutes, fmtDateLong } from "@/lib/time";
import { ACCOUNT_START, ACCOUNT_END } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  focus: "Focused work", break: "Break", rest: "Rest", travel: "Travel",
  social: "Social", personal: "Personal", unplanned: "Unplanned",
  other: "Other", sleep: "Sleep",
};

const W = 1080;
const H = 1500;
const TOP = 392;          // header + column captions
const BOTTOM = 96;
const TRACK = H - TOP - BOTTOM;
const PX = TRACK / (ACCOUNT_END - ACCOUNT_START);
const GUTTER = 86;        // hour labels
const GAP = 22;           // between the two columns
const COL = (W - 96 - GUTTER - GAP) / 2;

type Item = {
  start: number; end: number; label: string; color: string;
  faint: boolean; done?: boolean;
};

/**
 * Lays overlapping items into side-by-side lanes so nothing is drawn on top of
 * anything else — the same idea as the in-app timeline.
 */
function laneOut(items: Item[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const placed = sorted.map((it) => {
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.end); }
    else laneEnds[lane] = it.end;
    return { ...it, lane, nextStart: ACCOUNT_END };
  });
  // Cap how far a short item may grow, so its minimum height cannot reach
  // whatever starts next in the same lane.
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (placed[j].lane === placed[i].lane) { placed[i].nextStart = placed[j].start; break; }
    }
  }
  return { placed, lanes: Math.max(laneEnds.length, 1) };
}

/**
 * One day as a picture: what you planned beside what you actually logged.
 *
 * Two columns rather than one — a scheduled task and a logged block at the same
 * hour used to draw over each other, and the comparison is the point anyway.
 * `?labels=off` swaps names for categories so a schedule can be shared without
 * publishing what is on it.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const qDate = url.searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : todayInTz(user.timezone);
  const showLabels = url.searchParams.get("labels") !== "off";

  const [tasks, blocks, categories, summary] = await Promise.all([
    tasksForDay(user.id, date),
    blocksForDay(user.id, date),
    categoriesFor(user.id),
    daySummaryFor(user.id, date, user.timezone),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Planned: every task that has a time on it, ticked ones marked.
  // Actual: only what you logged — a tick is a claim, a logged block is a
  // record, so the two columns answer different questions.
  const planned: Item[] = [];
  const actual: Item[] = [];

  for (const t of tasks) {
    if (t.start_min === null || t.end_min === null) continue;
    const cat = t.category_id ? catMap.get(t.category_id) : undefined;
    planned.push({
      start: t.start_min, end: t.end_min,
      label: showLabels ? t.name : (cat?.name ?? "Task"),
      color: cat?.color ?? "#b8b8b0",
      faint: !t.completed,
      done: !!t.completed,
    });
  }
  for (const b of blocks) {
    actual.push({
      start: b.start_min, end: b.end_min,
      label: showLabels ? (b.label || KIND_LABEL[b.kind] || b.kind) : (KIND_LABEL[b.kind] ?? b.kind),
      color: b.kind === "sleep" ? "#cfcfc6" : b.kind === "focus" ? "#a8c5b4" : "#dcdcd4",
      faint: b.kind === "sleep",
    });
  }

  const L = laneOut(planned);
  const R = laneOut(actual);
  const y = (m: number) => TOP + (m - ACCOUNT_START) * PX;
  const hours = Array.from({ length: 25 }, (_, i) => i);

  const column = (
    side: "left" | "right",
    data: ReturnType<typeof laneOut>
  ) => {
    const x0 = side === "left" ? 48 + GUTTER : 48 + GUTTER + COL + GAP;
    const laneW = COL / data.lanes;
    return data.placed.map((it, i) => {
      const top = y(it.start);
      const raw = y(it.end) - top - 3;
      const room = y(it.nextStart) - top - 3;
      const height = Math.min(Math.max(raw, 26), Math.max(room, raw));
      // Satori does not clip an overflowing child the way a browser does, so a
      // long name used to spill out of its block and over the one below.
      // Give the text an explicit line budget for the height available and
      // truncate past it.
      const LINE = 26;
      // Below one full line there is no honest way to show text: Satori will
      // not clip it, so a short bar keeps its colour and drops its label.
      const showText = height >= LINE;
      const lines = Math.max(1, Math.floor((height - 8) / LINE));
      const single = lines === 1;
      return (
        <div key={`${side}${i}`} style={{
          position: "absolute", left: x0 + it.lane * laneW + 2, top,
          width: laneW - 6, height, display: "flex", alignItems: "center",
          padding: "0 12px", borderRadius: 10, overflow: "hidden",
          background: it.color, opacity: it.faint ? 0.45 : 1,
        }}>
          {it.done && (
            // Drawn as a path, not typed: the renderer has no font fallback,
            // so a tick character comes out as an empty box.
            <svg
              width="19" height="19" viewBox="0 0 24 24" fill="none"
              stroke="#3f6b52" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginRight: 8, flexShrink: 0 }}
            >
              <path d="M5 12.5 L10 17.5 L19 7" />
            </svg>
          )}
          {showText && (
            <div style={{
              fontSize: 21, color: "#1f1f19", lineHeight: `${LINE}px`,
              width: laneW - 30 - (it.done ? 28 : 0), overflow: "hidden",
              ...(single
                ? { whiteSpace: "nowrap" as const, textOverflow: "ellipsis" as const }
                : { display: "-webkit-box", WebkitBoxOrient: "vertical" as const,
                    WebkitLineClamp: lines, maxHeight: lines * LINE }),
            }}>
              {it.label}
            </div>
          )}
        </div>
      );
    });
  };

  return new ImageResponse(
    <div style={{
      width: W, height: H, display: "flex", flexDirection: "column",
      background: "#f7f5f1", color: "#26261f", padding: "44px 48px", position: "relative",
    }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 30, color: "#8a8a80", letterSpacing: 2 }}>YOUR 24 HOURS</div>
        <div style={{ fontSize: 52, marginTop: 8 }}>{user.display_name}</div>
        <div style={{ fontSize: 28, color: "#6b6b62", marginTop: 4 }}>{fmtDateLong(date)}</div>
        <div style={{ display: "flex", marginTop: 26 }}>
          {([
            ["Done", `${summary.tasksCompleted}/${summary.tasksPlanned}`],
            ["Planned", fmtMinutes(summary.plannedMinutes)],
            ["Completed", fmtMinutes(summary.completedMinutes)],
            ["Unaccounted", fmtMinutes(summary.unaccountedMinutes)],
          ] as [string, string][]).map(([l, v]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column", marginRight: 54 }}>
              <div style={{ fontSize: 22, color: "#8a8a80" }}>{l}</div>
              <div style={{ fontSize: 40, color: "#26261f", marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* column captions */}
      <div style={{
        position: "absolute", left: 48 + GUTTER, top: TOP - 38, width: COL,
        fontSize: 22, color: "#8a8a80", letterSpacing: 1, display: "flex",
      }}>
        PLANNED
      </div>
      <div style={{
        position: "absolute", left: 48 + GUTTER + COL + GAP, top: TOP - 38, width: COL,
        fontSize: 22, color: "#8a8a80", letterSpacing: 1, display: "flex",
      }}>
        ACTUAL
      </div>

      {hours.map((h) => (
        <div key={`h${h}`} style={{
          position: "absolute", left: 48, top: y(h * 60), width: W - 96,
          display: "flex", alignItems: "center",
        }}>
          <div style={{ width: GUTTER - 14, fontSize: 20, color: "#a0a098" }}>
            {`${String(h).padStart(2, "0")}:00`}
          </div>
          <div style={{ flex: 1, height: 1, background: "#e6e3dc" }} />
        </div>
      ))}

      {/* divider between the columns */}
      <div style={{
        position: "absolute", left: 48 + GUTTER + COL + GAP / 2, top: TOP,
        width: 1, height: TRACK, background: "#e0ddd5", display: "flex",
      }} />

      {column("left", L)}
      {column("right", R)}

      <div style={{
        position: "absolute", left: 48, bottom: 30, width: W - 96,
        display: "flex", justifyContent: "space-between", fontSize: 20, color: "#a0a098",
      }}>
        <div>Cadence · ticked = done · faded = not done · Actual = time you logged</div>
        <div>
          {summary.unaccountedMinutes === 0
            ? "Every hour accounted for"
            : `Score ${summary.score}`}
        </div>
      </div>
    </div>,
    {
      width: W, height: H,
      headers: {
        "Content-Disposition": `attachment; filename="cadence-${date}.png"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
