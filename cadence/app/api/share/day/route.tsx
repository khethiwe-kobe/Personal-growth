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
const TOP = 348;          // header height (title + date + stat row)
const BOTTOM = 96;        // footer, clear of the 24:00 label
const TRACK = H - TOP - BOTTOM;
const PX = TRACK / (ACCOUNT_END - ACCOUNT_START);
const GUTTER = 96;        // hour labels

/**
 * A shareable picture of one day's 24 hours — for sending to the group chat
 * instead of a cropped screenshot.
 *
 * Always the signed-in user's own day. `?labels=off` replaces task names with
 * their category, so a schedule can be shared without publishing what is on it.
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

  type Item = { start: number; end: number; label: string; color: string; sub: string; muted: boolean };
  const items: Item[] = [];
  for (const t of tasks) {
    if (t.start_min === null || t.end_min === null) continue;
    const cat = t.category_id ? catMap.get(t.category_id) : undefined;
    items.push({
      start: t.start_min, end: t.end_min,
      label: showLabels ? t.name : (cat?.name ?? "Task"),
      color: cat?.color ?? "#b8b8b0",
      sub: `${fmtClock(t.start_min)}–${fmtClock(t.end_min)}`,
      muted: !!t.completed,
    });
  }
  for (const b of blocks) {
    items.push({
      start: b.start_min, end: b.end_min,
      label: showLabels ? (b.label || KIND_LABEL[b.kind] || b.kind) : (KIND_LABEL[b.kind] ?? b.kind),
      color: b.kind === "sleep" ? "#cfcfc6" : b.kind === "focus" ? "#a8c5b4" : "#d8d8d0",
      sub: `${fmtClock(b.start_min)}–${fmtClock(b.end_min)}`,
      muted: b.kind === "sleep",
    });
  }
  items.sort((a, b) => a.start - b.start);

  const y = (m: number) => TOP + (m - ACCOUNT_START) * PX;
  const hours = Array.from({ length: 25 }, (_, i) => i);

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 54 }}>
      <div style={{ fontSize: 22, color: "#8a8a80" }}>{label}</div>
      <div style={{ fontSize: 40, color: "#26261f", marginTop: 4 }}>{value}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{
        width: W, height: H, display: "flex", flexDirection: "column",
        background: "#f7f5f1", color: "#26261f", padding: "44px 48px", position: "relative",
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: "#8a8a80", letterSpacing: 2 }}>YOUR 24 HOURS</div>
          <div style={{ fontSize: 52, marginTop: 8 }}>{user.display_name}</div>
          <div style={{ fontSize: 28, color: "#6b6b62", marginTop: 4 }}>{fmtDateLong(date)}</div>
          <div style={{ display: "flex", marginTop: 26 }}>
            <Stat label="Done" value={`${summary.tasksCompleted}/${summary.tasksPlanned}`} />
            <Stat label="Planned" value={fmtMinutes(summary.plannedMinutes)} />
            <Stat label="Completed" value={fmtMinutes(summary.completedMinutes)} />
            <Stat label="Unaccounted" value={fmtMinutes(summary.unaccountedMinutes)} />
          </div>
        </div>

        {/* hour grid */}
        {hours.map((h) => (
          <div key={`h${h}`} style={{
            position: "absolute", left: 48, top: y(h * 60), width: W - 96,
            display: "flex", alignItems: "center",
          }}>
            <div style={{ width: GUTTER - 16, fontSize: 20, color: "#a0a098" }}>
              {`${String(h).padStart(2, "0")}:00`}
            </div>
            <div style={{ flex: 1, height: 1, background: "#e6e3dc" }} />
          </div>
        ))}

        {/* blocks and tasks */}
        {items.map((it, i) => {
          const top = y(it.start);
          const height = Math.max(y(it.end) - top - 3, 30);
          return (
            <div key={`i${i}`} style={{
              position: "absolute", left: 48 + GUTTER, top, width: W - 96 - GUTTER,
              height, display: "flex", alignItems: "center", padding: "0 18px",
              background: it.color, opacity: it.muted ? 0.6 : 1,
              borderRadius: 12, overflow: "hidden",
            }}>
              <div style={{ fontSize: 24, color: "#1f1f19", overflow: "hidden" }}>{it.label}</div>
              {height >= 44 && (
                <div style={{ fontSize: 20, color: "#4a4a42", marginLeft: 14 }}>{it.sub}</div>
              )}
            </div>
          );
        })}

        <div style={{
          position: "absolute", left: 48, bottom: 30, width: W - 96,
          display: "flex", justifyContent: "space-between", fontSize: 20, color: "#a0a098",
        }}>
          <div>Cadence</div>
          <div>{summary.unaccountedMinutes === 0 ? "Every hour accounted for" : "Score " + summary.score}</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        "Content-Disposition": `attachment; filename="cadence-${date}.png"`,
        "Cache-Control": "no-store",
      },
    }
  );
}
