import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { summariesForRange, categoriesFor, allGoalStats } from "@/lib/repo";
import { todayInTz, addDays, startOfWeek, fmtMinutes, fmtDateShort } from "@/lib/time";
import { PageTitle, Card, SectionHeading, Ring, Stat, ProgressBar, Trend } from "@/components/ui";
import { LineChart, PairedBars, CategoryBars } from "@/components/charts";
import { IconInfo } from "@/components/icons";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const weekStartEarly = startOfWeek(today);
  const [last14, cats, goalStats, all8] = await Promise.all([
    summariesForRange(user.id, addDays(today, -13), today, user.timezone),
    categoriesFor(user.id),
    allGoalStats(user.id, today),
    summariesForRange(user.id, addDays(weekStartEarly, -49), today, user.timezone),
  ]);
  const last7 = last14.slice(-7);

  // Focus room accountability, this week — every number from real session
  // rows: planned focus tasks, ones actually joined, completions,
  // interruptions and time genuinely present.
  const weekEnd = addDays(weekStartEarly, 6);
  const [frPlanned, frJoined, frInts, frTime, frSessions] = await Promise.all([
    get<{ n: number; done: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(t.completed),0) AS done
         FROM tasks t LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id=? AND t.date>=? AND t.date<=?
          AND (t.focus_room=1 OR c.focus_room=1)`,
      [user.id, weekStartEarly, weekEnd]
    ),
    get<{ n: number }>(
      `SELECT COUNT(DISTINCT r.task_id) AS n
         FROM focus_rooms r JOIN focus_room_members m ON m.room_id=r.id
        WHERE m.user_id=? AND r.date>=? AND r.date<=?
          AND m.present_secs>0 AND r.task_id IS NOT NULL`,
      [user.id, weekStartEarly, weekEnd]
    ),
    get<{ n: number; secs: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(i.seconds),0) AS secs
         FROM focus_room_interruptions i JOIN focus_rooms r ON r.id=i.room_id
        WHERE i.user_id=? AND r.date>=? AND r.date<=?`,
      [user.id, weekStartEarly, weekEnd]
    ),
    get<{ secs: number }>(
      `SELECT COALESCE(SUM(m.present_secs),0) AS secs
         FROM focus_room_members m JOIN focus_rooms r ON r.id=m.room_id
        WHERE m.user_id=? AND r.date>=? AND r.date<=?`,
      [user.id, weekStartEarly, weekEnd]
    ),
    all<{ focus_seconds: number }>(
      `SELECT focus_seconds FROM focus_sessions
        WHERE user_id=? AND date>=? AND date<=? AND status!='active'`,
      [user.id, weekStartEarly, weekEnd]
    ),
  ]);
  const frAvg = frSessions.length
    ? Math.round(frSessions.reduce((a, b) => a + b.focus_seconds, 0) / frSessions.length / 60)
    : 0;
  const todaySum = last14[last14.length - 1];
  const catMap = new Map(cats.map((c) => [c.id, c]));
  const goals = goalStats.filter((g) => g.goal.status === "active");

  // hours by category, this week
  const weekStart = weekStartEarly;
  const week = last14.filter((s) => s.date >= weekStart);
  const catAgg = new Map<number | null, { planned: number; completed: number }>();
  for (const s of week)
    for (const c of s.byCategory) {
      const e = catAgg.get(c.categoryId) ?? { planned: 0, completed: 0 };
      e.planned += c.plannedMin;
      e.completed += c.completedMin;
      catAgg.set(c.categoryId, e);
    }
  const catRows = [...catAgg.entries()]
    .map(([id, v]) => ({
      label: id ? catMap.get(id)?.name ?? "Removed category" : "Uncategorised",
      color: id ? catMap.get(id)?.color ?? "#b8b8b0" : "#b8b8b0",
      value: v.planned, secondary: v.completed,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // weekly avg scores for 8 weeks
  const weekBuckets = new Map<string, number[]>();
  for (const s of all8) {
    if (s.tasksPlanned === 0 && s.goalsDue === 0) continue;
    const w = startOfWeek(s.date);
    const arr = weekBuckets.get(w) ?? [];
    arr.push(s.score);
    weekBuckets.set(w, arr);
  }
  const weeklyTrend = [...weekBuckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([w, scores]) => ({
      label: fmtDateShort(w),
      value: Math.round(scores.reduce((x, y) => x + y, 0) / scores.length),
    }));
  const thisWeekAvg = weeklyTrend[weeklyTrend.length - 1]?.value ?? 0;
  const lastWeekAvg = weeklyTrend[weeklyTrend.length - 2]?.value ?? 0;

  const abc = todaySum.byPriority;

  return (
    <div className="fade-up">
      <PageTitle title="Analytics" subtitle="Every number here comes from your actual data — nothing is decorative." />

      {/* Today + score explanation */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-5">
          <Ring pct={todaySum.score} size={110} sub="today's score" />
          <div className="space-y-1.5 text-sm">
            <Stat label="Tasks" value={`${todaySum.tasksCompleted}/${todaySum.tasksPlanned}`} />
            <Stat label="Hours" value={`${fmtMinutes(todaySum.completedMinutes)} / ${fmtMinutes(todaySum.plannedMinutes)}`} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
            <IconInfo size={14} /> How today's score is calculated
          </p>
          {todaySum.scoreParts.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">
              Nothing planned yet — the score starts once you have tasks or daily goals.
              An empty day is a rest day, not a zero.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {todaySum.scoreParts.map((p) => (
                <div key={p.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-ink-2">
                      {p.label} <span className="text-ink-3">· weight {Math.round(p.weight * 100)}%</span>
                    </span>
                    <span className="tabular-nums text-ink-2">
                      {Math.round(p.raw * 100)}% <span className="text-ink-3">({p.detail})</span>
                    </span>
                  </div>
                  <ProgressBar pct={p.raw * 100} height={5} />
                </div>
              ))}
              <p className="text-[11px] text-ink-3">
                Score = the weighted average of the parts above. Parts with no data are excluded
                and the remaining weights re-balance — planning nothing never counts as failing.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Today detail */}
      <SectionHeading>Today in numbers</SectionHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><Stat label="Overdue tasks" value={todaySum.overdueTasks} /></Card>
        <Card><Stat label="Unaccounted" value={fmtMinutes(todaySum.unaccountedMinutes)} sub="06:00–22:00" /></Card>
        <Card><Stat label="Focus" value={fmtMinutes(todaySum.focusMinutes)}
          sub={`${todaySum.focusInterrupted} interrupted`} /></Card>
        <Card><Stat label="Daily goals" value={`${todaySum.goalsCompleted}/${todaySum.goalsDue}`} /></Card>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {(["A", "B", "C"] as const).map((p) => (
          <Card key={p}>
            <div className="flex items-center justify-between">
              <Stat
                label={`Priority ${p} ${p === "A" ? "· must do" : p === "B" ? "· important" : "· nice to do"}`}
                value={`${abc[p].completed}/${abc[p].planned}`}
              />
              <Ring size={44} stroke={4.5}
                pct={abc[p].planned ? (abc[p].completed / abc[p].planned) * 100 : 0}
                label={<span className="text-[9px] font-semibold">
                  {abc[p].planned ? Math.round((abc[p].completed / abc[p].planned) * 100) : 0}%
                </span>} />
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <SectionHeading>Focus sessions — this week</SectionHeading>
      <Card>
        {frPlanned && frPlanned.n > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-5">
              <Stat label="Planned" value={String(frPlanned.n)} sub="focus session tasks" />
              <Stat label="Joined" value={String(frJoined?.n ?? 0)}
                sub={frPlanned.n ? `${Math.round(((frJoined?.n ?? 0) / frPlanned.n) * 100)}% of planned` : ""} />
              <Stat label="Completed" value={String(frPlanned.done)} />
              <Stat label="Interruptions" value={String(frInts?.n ?? 0)}
                sub={frInts?.secs ? `${Math.round(frInts.secs / 60)}m away in total` : ""} />
              <Stat label="In the room" value={fmtMinutes(Math.round((frTime?.secs ?? 0) / 60))}
                sub={frAvg ? `avg session ${fmtMinutes(frAvg)}` : ""} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-2">
              You planned {frPlanned.n} focus session{frPlanned.n === 1 ? "" : "s"} this week,
              joined {frJoined?.n ?? 0} and completed {frPlanned.done}.
              {(frInts?.n ?? 0) > 0
                ? ` ${frInts?.n} interruption${(frInts?.n ?? 0) === 1 ? "" : "s"} recorded.`
                : " No interruptions recorded."}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-3">
            No focus sessions planned this week. Tag a task as a focus session on Today and
            it will be tracked here — planned, joined, completed, interrupted.
          </p>
        )}
      </Card>

      <SectionHeading>Planned vs completed hours — last 7 days</SectionHeading>
      <Card>
        <PairedBars
          title="Planned vs completed hours per day, last 7 days"
          data={last7.map((s) => ({
            label: fmtDateShort(s.date),
            planned: Math.round((s.plannedMinutes / 60) * 10) / 10,
            actual: Math.round((s.completedMinutes / 60) * 10) / 10,
          }))}
        />
      </Card>

      <SectionHeading>Hours by category — this week</SectionHeading>
      <Card>
        {catRows.length === 0 ? (
          <p className="text-sm text-ink-3">No categorised tasks this week yet.</p>
        ) : (
          <>
            <CategoryBars rows={catRows} formatValue={(v) => fmtMinutes(v)} />
            <p className="mt-3 text-[11px] text-ink-3">
              Solid = completed, faded = planned.
            </p>
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeading>
            Weekly score trend <span className="ml-2 normal-case tracking-normal"><Trend delta={thisWeekAvg - lastWeekAvg} /></span>
          </SectionHeading>
          <Card>
            {weeklyTrend.length < 2 ? (
              <p className="text-sm text-ink-3">Come back after a week or two of data.</p>
            ) : (
              <LineChart title="Average productivity score per week" points={weeklyTrend} yMax={100} unit="%" />
            )}
          </Card>
        </div>
        <div>
          <SectionHeading>Task completion — last 14 days</SectionHeading>
          <Card>
            <LineChart
              title="Task completion percentage per day"
              points={last14.map((s) => ({ label: fmtDateShort(s.date), value: s.completionPct }))}
              yMax={100} unit="%"
            />
          </Card>
        </div>
      </div>

      {/* Goal consistency */}
      <SectionHeading>Goal consistency</SectionHeading>
      {goals.length === 0 ? (
        <p className="text-sm text-ink-3">No active goals.</p>
      ) : (
        <Card>
          <CategoryBars
            rows={goals.map(({ goal, stats }) => ({
              label: goal.title,
              color: (goal.category_id && catMap.get(goal.category_id)?.color) || "#b8b8b0",
              value: stats.consistencyPct,
            }))}
            formatValue={(v) => `${Math.round(v)}%`}
          />
        </Card>
      )}
    </div>
  );
}
