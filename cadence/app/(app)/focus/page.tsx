import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { summariesForRange } from "@/lib/repo";
import { todayInTz, addDays, startOfWeek, monthOf, monthDates, fmtMinutes, fmtDateShort } from "@/lib/time";
import { PageTitle, Card, SectionHeading, Stat } from "@/components/ui";
import FocusTimer from "@/components/FocusTimer";
import type { FocusSessionRow } from "@/lib/types";

export const metadata = { title: "Focus" };
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  distracted: "distracted", urgent: "urgent matter", unplanned_break: "unplanned break",
  technical: "technical issue", other: "other",
};

export default async function FocusPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const weekStart = startOfWeek(today);
  const monthStart = monthOf(today) + "-01";

  type Agg = { sec: number; n: number; done: number; interrupted: number };
  const agg = (from: string) =>
    get<Agg>(
      `SELECT COALESCE(SUM(focus_seconds),0) AS sec,
              COUNT(*) AS n,
              COALESCE(SUM(status='completed'),0) AS done,
              COALESCE(SUM(status='interrupted'),0) AS interrupted
         FROM focus_sessions
        WHERE user_id=? AND date>=? AND date<=? AND status!='active'`,
      [user.id, from, today]
    );

  const [settings, dayAggRaw, weekAggRaw, monthAggRaw, recent] = await Promise.all([
    get<{ focus_defaults: string }>(
      "SELECT focus_defaults FROM user_settings WHERE user_id=?", [user.id]
    ),
    agg(today),
    agg(weekStart),
    agg(monthStart),
    all<FocusSessionRow>(
      `SELECT * FROM focus_sessions WHERE user_id=? AND status!='active'
       ORDER BY started_at DESC LIMIT 8`,
      [user.id]
    ),
  ]);
  let defaults = {};
  try { defaults = JSON.parse(settings?.focus_defaults || "{}"); } catch {}
  const empty: Agg = { sec: 0, n: 0, done: 0, interrupted: 0 };
  const dayAgg = dayAggRaw ?? empty;
  const weekAgg = weekAggRaw ?? empty;
  const monthAgg = monthAggRaw ?? empty;

  return (
    <div className="fade-up">
      <PageTitle
        title="Focus"
        subtitle="Your timer, your rules — 25/5 rounds or a six-hour block with no breaks."
      />

      <FocusTimer defaults={defaults} />

      <SectionHeading>Your focus time</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><Stat label="Today" value={fmtMinutes(Math.round(dayAgg.sec / 60))}
          sub={`${dayAgg.done ?? 0} completed · ${dayAgg.interrupted ?? 0} interrupted`} /></Card>
        <Card><Stat label="This week" value={fmtMinutes(Math.round(weekAgg.sec / 60))}
          sub={`${weekAgg.n} sessions`} /></Card>
        <Card><Stat label="This month" value={fmtMinutes(Math.round(monthAgg.sec / 60))}
          sub={`${monthAgg.n} sessions`} /></Card>
      </div>

      {recent.length > 0 && (
        <>
          <SectionHeading>Recent sessions</SectionHeading>
          <Card pad={false}>
            <ul className="divide-y divide-line">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${
                    s.status === "completed" ? "bg-ok" : "bg-danger"
                  }`} />
                  <span className="min-w-0 flex-1 truncate">
                    {s.label || "Focus"} · {fmtMinutes(Math.round(s.focus_seconds / 60))}
                    <span className="text-ink-3"> of {fmtMinutes(s.planned_minutes)} planned</span>
                  </span>
                  {s.status === "interrupted" && (
                    <span className="text-xs text-danger">
                      interrupted{s.interrupt_reason ? ` — ${REASON_LABEL[s.interrupt_reason] ?? s.interrupt_reason}` : ""}
                    </span>
                  )}
                  <span className="text-xs tabular-nums text-ink-3">{fmtDateShort(s.date)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <SectionHeading>Do Not Disturb — the honest version</SectionHeading>
      <Card className="text-sm leading-relaxed text-ink-2">
        <p>
          A web app <strong>cannot</strong> put your phone, iPad or computer into Do Not Disturb —
          the operating system doesn't allow it, and we won't pretend otherwise. What actually works:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
          <li>Use <strong>Full screen</strong> during a session (button appears while running).</li>
          <li>Enable browser notifications above so session changes reach you without checking the tab.</li>
          <li>Turn on DND yourself: <span className="text-ink-3">iPhone/iPad — Settings → Focus;
          Android — swipe down → Do Not Disturb; macOS — Control Centre → Focus;
          Windows — Settings → System → Notifications → Do not disturb.</span></li>
          <li>Leaving the tab mid-focus counts as an interruption — that's the deal you made with yourself.</li>
        </ul>
      </Card>
    </div>
  );
}
