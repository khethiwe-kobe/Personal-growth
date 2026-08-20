import { ImageResponse } from "next/og";
import { requireUser } from "@/lib/auth";
import { summariesForRange, tasksForDay, blocksForDay, categoriesFor } from "@/lib/repo";
import {
  todayInTz, startOfWeek, addDays, monthOf, monthDates, fmtMinutes, fmtDateShort,
} from "@/lib/time";
import { ACCOUNT_END } from "@/lib/analytics";
import type { DaySummary } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const W = 1080;
const H = 1500;
const BG = "#f7f5f1";
const INK = "#26261f";
const MUTED = "#8a8a80";
const LINE = "#e6e3dc";

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Week and month pictures for the group chat, matching the day image.
 *
 * A week is drawn as seven 24-hour columns — the same midnight-to-midnight
 * accounting as one day, side by side, so patterns are visible at a glance.
 * A month is a calendar of daily scores. `?labels=off` drops task names.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const range = url.searchParams.get("range") === "month" ? "month" : "week";
  const showLabels = url.searchParams.get("labels") !== "off";
  const today = todayInTz(user.timezone);

  return range === "week"
    ? weekImage(user, today, showLabels)
    : monthImage(user, today);
}

type U = { id: number; display_name: string; timezone: string };

function Header({ kicker, name, sub, stats }: {
  kicker: string; name: string; sub: string; stats: [string, string][];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 30, color: MUTED, letterSpacing: 2 }}>{kicker}</div>
      <div style={{ fontSize: 52, marginTop: 8 }}>{name}</div>
      <div style={{ fontSize: 28, color: "#6b6b62", marginTop: 4 }}>{sub}</div>
      <div style={{ display: "flex", marginTop: 26 }}>
        {stats.map(([label, value]) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", marginRight: 50 }}>
            <div style={{ fontSize: 21, color: MUTED }}>{label}</div>
            <div style={{ fontSize: 38, color: INK, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Satori does not flatten fragments the way the DOM does — a wrapper helper
// taking `children` left absolutely-positioned footers laid out in flow at the
// top of the image. Each view builds its own root element instead.
const ROOT: React.CSSProperties = {
  width: W, height: H, display: "flex", flexDirection: "column",
  background: BG, color: INK, padding: "44px 48px", position: "relative",
};
const OPTS = { width: W, height: H, headers: { "Cache-Control": "no-store" } };

function Footer({ right }: { right: string }) {
  return (
    <div style={{
      position: "absolute", left: 48, bottom: 30, width: W - 96,
      display: "flex", justifyContent: "space-between", fontSize: 20, color: "#a0a098",
    }}>
      <div>Cadence</div>
      <div>{right}</div>
    </div>
  );
}

async function weekImage(user: U, today: string, showLabels: boolean) {
  const start = startOfWeek(today);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const [summaries, categories] = await Promise.all([
    summariesForRange(user.id, start, end, user.timezone),
    categoriesFor(user.id),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const perDay = await Promise.all(
    days.map(async (d) => ({
      date: d,
      tasks: await tasksForDay(user.id, d),
      blocks: await blocksForDay(user.id, d),
    }))
  );

  const done = summaries.reduce((s, d) => s + d.tasksCompleted, 0);
  const planned = summaries.reduce((s, d) => s + d.tasksPlanned, 0);
  const focus = summaries.reduce((s, d) => s + d.focusMinutes, 0);
  const unacc = summaries.reduce((s, d) => s + d.unaccountedMinutes, 0);
  const active = summaries.filter((d) => d.tasksPlanned > 0 || d.goalsDue > 0);
  const avg = active.length
    ? Math.round(active.reduce((s, d) => s + d.score, 0) / active.length) : 0;

  const TOP = 360, BOTTOM = 96;
  const TRACK = H - TOP - BOTTOM;
  const PX = TRACK / ACCOUNT_END;
  const GUT = 74;
  const colW = (W - 96 - GUT) / 7;

  return new ImageResponse(
    <div style={ROOT}>
      <Header
        kicker="MY WEEK" name={user.display_name}
        sub={`${fmtDateShort(start)} – ${fmtDateShort(end)}`}
        stats={[
          ["Tasks", `${done}/${planned}`],
          ["Avg score", String(avg)],
          ["Focus", fmtMinutes(focus)],
          ["Unaccounted", fmtMinutes(unacc)],
        ]}
      />

      {[0, 6, 12, 18, 24].map((h) => (
        <div key={`g${h}`} style={{
          position: "absolute", left: 48, top: TOP + h * 60 * PX, width: W - 96,
          display: "flex", alignItems: "center",
        }}>
          <div style={{ width: GUT - 14, fontSize: 19, color: "#a0a098" }}>
            {`${String(h).padStart(2, "0")}:00`}
          </div>
          <div style={{ flex: 1, height: 1, background: LINE }} />
        </div>
      ))}

      {perDay.map((d, i) => (
        <div key={`d${i}`} style={{
          position: "absolute", left: 48 + GUT + i * colW, top: TOP - 34,
          width: colW - 6, display: "flex", justifyContent: "center",
          fontSize: 20, color: d.date === today ? INK : MUTED,
        }}>
          {`${DAY_LETTERS[i]} ${d.date.slice(8)}`}
        </div>
      ))}

      {perDay.flatMap((d, i) => {
        const items: { s: number; e: number; color: string; label: string }[] = [];
        for (const t of d.tasks) {
          if (t.start_min === null || t.end_min === null) continue;
          const cat = t.category_id ? catMap.get(t.category_id) : undefined;
          items.push({ s: t.start_min, e: t.end_min, color: cat?.color ?? "#b8b8b0",
            label: showLabels ? t.name : (cat?.name ?? "") });
        }
        for (const b of d.blocks) {
          items.push({ s: b.start_min, e: b.end_min,
            color: b.kind === "sleep" ? "#cfcfc6" : b.kind === "focus" ? "#a8c5b4" : "#dcdcd4",
            label: "" });
        }
        return items.map((it, k) => (
          <div key={`b${i}-${k}`} style={{
            position: "absolute", left: 48 + GUT + i * colW + 3,
            top: TOP + it.s * PX, width: colW - 12,
            height: Math.max((it.e - it.s) * PX - 2, 4),
            background: it.color, borderRadius: 5,
          }} />
        ));
      })}

      <Footer right={`${active.length} day${active.length === 1 ? "" : "s"} planned`} />
    </div>,
    OPTS
  );
}

async function monthImage(user: U, today: string) {
  const month = monthOf(today);
  const dates = monthDates(month);
  const summaries = await summariesForRange(
    user.id, dates[0], dates[dates.length - 1], user.timezone
  );
  const byDate = new Map(summaries.map((s) => [s.date, s]));

  const active = summaries.filter((d) => d.date <= today && (d.tasksPlanned > 0 || d.goalsDue > 0));
  const avg = active.length
    ? Math.round(active.reduce((s, d) => s + d.score, 0) / active.length) : 0;
  const done = summaries.reduce((s, d) => s + d.tasksCompleted, 0);
  const planned = summaries.reduce((s, d) => s + d.tasksPlanned, 0);
  const focus = summaries.reduce((s, d) => s + d.focusMinutes, 0);

  // Calendar grid, Monday-first.
  const firstDow = (new Date(dates[0] + "T12:00:00Z").getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...dates,
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = cells.length / 7;

  const TOP = 380;
  const CELL = Math.min((W - 96) / 7, (H - TOP - 120) / rows);
  const shade = (s: DaySummary | undefined, date: string) => {
    if (!s || date > today) return "#efece6";
    if (s.tasksPlanned === 0 && s.goalsDue === 0) return "#e8e5de";
    const t = Math.max(0, Math.min(1, s.score / 100));
    // pale sage → deeper sage as the score rises
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    return `rgb(${mix(226, 138)}, ${mix(232, 184)}, ${mix(222, 156)})`;
  };

  return new ImageResponse(
    <div style={ROOT}>
      <Header
        kicker="MY MONTH" name={user.display_name}
        sub={new Date(month + "-01T12:00:00Z").toLocaleDateString("en-GB", {
          month: "long", year: "numeric", timeZone: "UTC",
        })}
        stats={[
          ["Avg score", String(avg)],
          ["Tasks", `${done}/${planned}`],
          ["Focus", fmtMinutes(focus)],
          ["Days planned", String(active.length)],
        ]}
      />

      {DAY_LETTERS.map((d, i) => (
        <div key={`hd${i}`} style={{
          position: "absolute", left: 48 + i * CELL, top: TOP - 34, width: CELL,
          display: "flex", justifyContent: "center", fontSize: 20, color: MUTED,
        }}>
          {d}
        </div>
      ))}

      {cells.map((date, i) => {
        if (!date) return null;
        const s = byDate.get(date);
        const col = i % 7, row = Math.floor(i / 7);
        return (
          <div key={`c${i}`} style={{
            position: "absolute", left: 48 + col * CELL + 4, top: TOP + row * CELL + 4,
            width: CELL - 8, height: CELL - 8, borderRadius: 14,
            background: shade(s, date), display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            border: date === today ? "3px solid #6f8f7c" : "none",
          }}>
            <div style={{ fontSize: 24, color: "#3a3a32" }}>{String(Number(date.slice(8)))}</div>
            {s && date <= today && (s.tasksPlanned > 0 || s.goalsDue > 0) && (
              <div style={{ fontSize: 18, color: "#4f4f46", marginTop: 2 }}>{String(s.score)}</div>
            )}
          </div>
        );
      })}

      <Footer right="Daily score — deeper means a better day" />
    </div>,
    OPTS
  );
}
