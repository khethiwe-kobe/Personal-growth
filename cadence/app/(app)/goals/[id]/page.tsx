import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categoriesFor, checkinsFor } from "@/lib/repo";
import { computeGoalStats, trimNum, goalDueLabel } from "@/lib/goals";
import { todayInTz, fmtDateShort, addDays } from "@/lib/time";
import type { GoalRow } from "@/lib/types";
import { Card, Chip, PageTitle, Ring, Stat, Button, SectionHeading } from "@/components/ui";
import { IconFlame, IconLock } from "@/components/icons";
import { CheckinRow } from "@/components/GoalCheckin";
import { goalStatusAction } from "@/app/actions";
import GoalEdit from "@/components/GoalEdit";

export const dynamic = "force-dynamic";

export default async function GoalDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const goal = getDb()
    .prepare("SELECT * FROM goals WHERE id=? AND user_id=?")
    .get(Number(id), user.id) as GoalRow | undefined;
  if (!goal) notFound();

  const today = todayInTz(user.timezone);
  const checkins = checkinsFor(goal.id);
  const stats = computeGoalStats(goal, checkins, today);
  const categories = categoriesFor(user.id);
  const cat = goal.category_id ? categories.find((c) => c.id === goal.category_id) : undefined;
  const recent = stats.periods.slice(-42); // last ~6 weeks of periods
  const yesterday = addDays(today, -1);
  const yesterdayPeriod = goal.frequency === "daily"
    ? stats.periods.find((p) => p.key === yesterday)
    : null;

  return (
    <div className="fade-up mx-auto max-w-3xl">
      <PageTitle
        title={goal.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            {cat && <Chip color={cat.color}>{cat.name}</Chip>}
            <Chip>{goal.frequency}</Chip>
            <Chip>{goalDueLabel(goal)}</Chip>
            {goal.deadline && <Chip>until {fmtDateShort(goal.deadline)}</Chip>}
            {goal.status !== "active" && <Chip>{goal.status}</Chip>}
            {!goal.share_progress && <Chip>hidden from group</Chip>}
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-center">
          <Ring pct={stats.overallPct} size={110} sub="overall" />
        </Card>
        <Card className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
            <Stat label="Consistency" value={`${stats.consistencyPct}%`}
              sub={`${stats.completedPeriods}/${stats.elapsedPeriods} periods`} />
            <Stat label="Current streak" value={
              <span className="inline-flex items-center gap-1">
                {stats.currentStreak}
                {stats.currentStreak > 0 && <IconFlame size={16} className="text-warn" />}
              </span>
            } />
            <Stat label="Longest streak" value={stats.longestStreak} />
            <Stat label="Missed" value={stats.missedPeriods}
              sub={goal.frequency === "daily" ? "days" : goal.frequency === "weekly" ? "weeks" : "months"} />
            <Stat label="Total logged" value={`${trimNum(stats.cumulativeValue)}${goal.unit ? ` ${goal.unit}` : ""}`}
              sub={goal.overall_target ? `of ${trimNum(goal.overall_target)}` : undefined} />
            <Stat label="This week" value={`${trimNum(stats.weekValue)}/${trimNum(stats.weekTarget)}`}
              sub={goal.unit || undefined} />
          </div>
        </Card>
      </div>

      {/* Check-in */}
      {goal.status === "active" && stats.currentPeriod && (
        <>
          <SectionHeading>
            {goal.frequency === "daily" ? "Today" : goal.frequency === "weekly" ? "This week" : "This month"}
          </SectionHeading>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {goal.daily_action || goal.measurement || "Log your progress"}
                </p>
                <p className="mt-0.5 text-xs text-ink-3">
                  Target: {trimNum(goal.period_target)}{goal.unit ? ` ${goal.unit}` : ""}
                  {goal.minimum_target > 0 && ` · minimum ${trimNum(goal.minimum_target)}`}
                </p>
              </div>
              <CheckinRow
                goalId={goal.id} date={today}
                value={goal.frequency === "daily" ? stats.todayValue : stats.todayValue}
                target={goal.frequency === "daily" ? goal.period_target : goal.period_target}
                trackingType={goal.tracking_type} unit={goal.unit} minimum={goal.minimum_target}
              />
            </div>
            {goal.frequency !== "daily" && stats.currentPeriod && (
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-2">
                Period so far: <strong>{trimNum(stats.currentPeriod.value)}</strong> of{" "}
                {trimNum(stats.currentPeriod.target)}{goal.unit ? ` ${goal.unit}` : ""} — today's entry adds to it.
              </p>
            )}
            {yesterdayPeriod && !yesterdayPeriod.complete && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                <span className="text-xs text-ink-3">Forgot to log yesterday?</span>
                <CheckinRow
                  goalId={goal.id} date={yesterday} value={yesterdayPeriod.value}
                  target={goal.period_target} trackingType={goal.tracking_type}
                  unit={goal.unit} minimum={goal.minimum_target}
                />
              </div>
            )}
          </Card>
        </>
      )}

      {/* History */}
      <SectionHeading>History</SectionHeading>
      <Card>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-3">No history yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1">
              {recent.map((p) => (
                <span
                  key={p.key}
                  title={`${p.key}: ${trimNum(p.value)}/${trimNum(p.target)}${p.inProgress ? " (in progress)" : ""}`}
                  className={`h-5 rounded-[5px] ${goal.frequency === "daily" ? "w-5" : "w-10"} ${
                    p.inProgress ? "ring-1 ring-accent" : ""
                  }`}
                  style={{
                    background: p.complete
                      ? "var(--accent)"
                      : p.minimumMet && p.value > 0
                        ? "color-mix(in oklab, var(--accent) 45%, var(--ring-track))"
                        : p.value > 0
                          ? "color-mix(in oklab, var(--accent) 22%, var(--ring-track))"
                          : "var(--ring-track)",
                  }}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[4px]" style={{ background: "var(--accent)" }} /> target met
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[4px]" style={{ background: "color-mix(in oklab, var(--accent) 45%, var(--ring-track))" }} /> minimum met
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-[4px]" style={{ background: "var(--ring-track)" }} /> missed
              </span>
            </div>
          </>
        )}
      </Card>

      {/* Private detail */}
      <SectionHeading>
        <span className="inline-flex items-center gap-1.5"><IconLock size={13} /> Private to you</span>
      </SectionHeading>
      <Card className="space-y-3 text-sm">
        {goal.why && <div><p className="text-xs font-medium text-ink-3">Why this matters</p><p className="mt-0.5">{goal.why}</p></div>}
        {goal.measurement && <div><p className="text-xs font-medium text-ink-3">Measurement</p><p className="mt-0.5">{goal.measurement}</p></div>}
        {goal.daily_action && <div><p className="text-xs font-medium text-ink-3">Recurring action</p><p className="mt-0.5">{goal.daily_action}</p></div>}
        {goal.evidence && <div><p className="text-xs font-medium text-ink-3">Evidence</p><p className="mt-0.5">{goal.evidence}</p></div>}
        {!goal.why && !goal.measurement && !goal.daily_action && !goal.evidence && (
          <p className="text-ink-3">No private notes on this goal.</p>
        )}
      </Card>

      {/* Manage */}
      <SectionHeading>Manage</SectionHeading>
      <Card>
        <div className="flex flex-wrap gap-2">
          {goal.status === "active" && (
            <>
              <form action={goalStatusAction}>
                <input type="hidden" name="id" value={goal.id} />
                <input type="hidden" name="action" value="pause" />
                <Button variant="ghost">Pause goal</Button>
              </form>
              <form action={goalStatusAction}>
                <input type="hidden" name="id" value={goal.id} />
                <input type="hidden" name="action" value="complete" />
                <Button variant="soft">Mark achieved</Button>
              </form>
            </>
          )}
          {goal.status === "paused" && (
            <form action={goalStatusAction}>
              <input type="hidden" name="id" value={goal.id} />
              <input type="hidden" name="action" value="resume" />
              <Button variant="soft">Resume goal</Button>
            </form>
          )}
          {goal.status === "completed" && (
            <form action={goalStatusAction}>
              <input type="hidden" name="id" value={goal.id} />
              <input type="hidden" name="action" value="reactivate" />
              <Button variant="ghost">Reactivate</Button>
            </form>
          )}
          <form action={goalStatusAction} className="ml-auto">
            <input type="hidden" name="id" value={goal.id} />
            <input type="hidden" name="action" value="archive" />
            <Button variant="danger">Archive</Button>
          </form>
        </div>
        {goal.status === "paused" && (
          <p className="mt-3 text-xs text-ink-3">
            Paused days don't count against your consistency or streaks.
          </p>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <GoalEdit goal={goal} categories={categories} />
        </div>
      </Card>

      <p className="mt-6 text-center text-xs text-ink-3">
        <Link href="/goals" className="font-medium text-accent-ink hover:underline">← All goals</Link>
      </p>
    </div>
  );
}
