import Link from "next/link";
import { requireUser, getGroupForUser } from "@/lib/auth";
import {
  daySummaryFor, sharedToday, goalsDueToday, countdownEvents, upcomingEvents,
  summariesForRange, allGoalStats,
} from "@/lib/repo";
import { messagesForMe, messageForFriend } from "@/lib/encourage";
import { productiveDayStreak } from "@/lib/analytics";
import { todayInTz, addDays, fmtDateLong, fmtMinutes, fmtDateShort, diffDays } from "@/lib/time";
import { trimNum } from "@/lib/goals";
import { Card, SectionHeading, Ring, Stat, ProgressBar, Chip, LinkButton, EmptyState } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import Avatar from "@/components/Avatar";
import { IconArrowR, IconFlame, IconLock } from "@/components/icons";
import { CheckinQuick } from "@/components/GoalCheckin";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const [summary, me, group, countdowns, upcomingRaw, trend, goalStats] = await Promise.all([
    daySummaryFor(user.id, today, user.timezone),
    sharedToday(user.id),
    getGroupForUser(user.id),
    countdownEvents(user.id, today),
    upcomingEvents(user.id, today, 5),
    summariesForRange(user.id, addDays(today, -13), today, user.timezone),
    allGoalStats(user.id, today),
  ]);
  const friends = (group?.members ?? []).filter((m) => m.id !== user.id);
  const friendSnaps = await Promise.all(
    friends.map(async (f) => ({ member: f, snap: await sharedToday(f.id) }))
  );
  const messages = messagesForMe(me, friendSnaps.map((f) => f.snap));
  const upcoming = upcomingRaw.filter((e) => !countdowns.some((c) => c.id === e.id));
  const streak = productiveDayStreak(trend, today);
  const goalHighlights = goalStats
    .filter((g) => g.goal.status === "active")
    .sort((a, b) => (b.stats.todayTarget !== null ? 1 : 0) - (a.stats.todayTarget !== null ? 1 : 0))
    .slice(0, 4);

  const firstName = user.display_name.split(" ")[0];
  const hourNow = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: user.timezone, hour: "2-digit", hour12: false })
      .format(new Date())
  );
  const greeting = hourNow < 12 ? "Good morning" : hourNow < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="fade-up">
      <div className="mb-6">
        <p className="text-sm text-ink-3">{fmtDateLong(today)}</p>
        <h1 className="mt-1 font-display text-[26px] font-medium leading-tight sm:text-3xl">
          {greeting}, {firstName}
        </h1>
      </div>

      {/* Today */}
      <SectionHeading
        action={<Link href="/today" className="text-xs font-medium text-accent-ink hover:underline">Open today's plan</Link>}
      >
        Today
      </SectionHeading>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-5 lg:col-span-1">
          <Ring pct={summary.score} size={104} sub="today" />
          <div className="min-w-0 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-ink-2">Tasks</span>
              <span className="font-semibold tabular-nums">{summary.tasksCompleted}/{summary.tasksPlanned}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-ink-2">Goals</span>
              <span className="font-semibold tabular-nums">{summary.goalsCompleted}/{summary.goalsDue}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-ink-2">Focus</span>
              <span className="font-semibold tabular-nums">{fmtMinutes(summary.focusMinutes)}</span>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-warn">
                <IconFlame size={14} /> {streak}-day productive streak
              </div>
            )}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <Stat label="Planned hours" value={fmtMinutes(summary.plannedMinutes)} />
            <Stat label="Completed hours" value={fmtMinutes(summary.completedMinutes)} />
            <Stat label="Unaccounted" value={fmtMinutes(summary.unaccountedMinutes)}
              sub={summary.unaccountedMinutes > 90 ? "worth a look" : "so far today"} />
            <Stat label="Focus sessions" value={`${summary.focusCompleted}/${summary.focusSessions || 0}`}
              sub={summary.focusInterrupted ? `${summary.focusInterrupted} interrupted` : "completed"} />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-ink-3">
              <span>Task completion</span><span>{summary.completionPct}%</span>
            </div>
            <ProgressBar pct={summary.completionPct} />
            {messages.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {messages.map((m) => (
                  <li key={m} className="text-[13px] text-ink-2">
                    <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Your goals */}
      <SectionHeading
        action={<Link href="/goals" className="text-xs font-medium text-accent-ink hover:underline">All goals</Link>}
      >
        Your goals
      </SectionHeading>
      {goalHighlights.length === 0 ? (
        <EmptyState
          title="No goals yet"
          hint="A measurable goal beats a vague intention. Create your first one."
          action={<LinkButton href="/goals/new" variant="soft">Create a goal</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goalHighlights.map(({ goal, stats }) => (
            <Card key={goal.id} className="flex items-center gap-4" pad={false}>
              <div className="flex w-full items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/goals/${goal.id}`} className="block truncate text-sm font-medium hover:underline">
                    {goal.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
                    <span>{stats.overallPct}% overall</span>
                    {stats.currentStreak > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-warn">
                        <IconFlame size={12} />{stats.currentStreak}
                      </span>
                    )}
                  </div>
                  <ProgressBar
                    className="mt-2"
                    pct={
                      stats.todayTarget !== null
                        ? (stats.todayValue / stats.todayTarget) * 100
                        : stats.currentPeriod
                          ? (stats.currentPeriod.value / Math.max(stats.currentPeriod.target, 0.001)) * 100
                          : stats.overallPct
                    }
                    height={5}
                  />
                </div>
                {stats.todayTarget !== null && (
                  <CheckinQuick
                    goalId={goal.id}
                    date={today}
                    value={stats.todayValue}
                    target={stats.todayTarget}
                    trackingType={goal.tracking_type}
                    unit={goal.unit}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Accountability */}
      <SectionHeading
        action={<Link href="/accountability" className="text-xs font-medium text-accent-ink hover:underline">Group view</Link>}
      >
        Accountability
      </SectionHeading>
      {friendSnaps.length === 0 ? (
        <EmptyState title="No group members yet" hint="Share your group's invite code so your friends can join." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {friendSnaps.map(({ member, snap }) => (
            <Card key={member.id}>
              <div className="flex items-center gap-3">
                <Avatar name={member.display_name} accent={member.accent}
                  userId={member.id} hasAvatar={member.has_avatar} size={38} />
                <div className="min-w-0 flex-1">
                  <Link href={`/accountability/${member.username}`}
                    className="block truncate text-sm font-semibold hover:underline">
                    {member.display_name}
                  </Link>
                  <p className="truncate text-xs text-ink-3">
                    {messageForFriend(snap, member.display_name.split(" ")[0])}
                  </p>
                </div>
                <Ring pct={snap.score} size={54} stroke={5}
                  label={<span className="text-xs font-semibold">{snap.score}%</span>} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
                <div className="flex justify-between"><span className="text-ink-3">Tasks</span>
                  <span className="font-medium tabular-nums">{snap.tasksCompleted}/{snap.tasksPlanned}</span></div>
                <div className="flex justify-between"><span className="text-ink-3">Goals</span>
                  <span className="font-medium tabular-nums">{snap.goalsCompleted}/{snap.goalsDue}</span></div>
                <div className="flex justify-between"><span className="text-ink-3">Planned</span>
                  <span className="font-medium tabular-nums">{fmtMinutes(snap.plannedMinutes)}</span></div>
                <div className="flex justify-between"><span className="text-ink-3">Done</span>
                  <span className="font-medium tabular-nums">{fmtMinutes(snap.completedMinutes)}</span></div>
              </div>
              {snap.productiveStreak > 0 && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-warn">
                  <IconFlame size={13} /> {snap.productiveStreak}-day streak
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-3">
        <IconLock size={12} /> You see each other's numbers, never each other's task names, schedules or notes.
      </p>

      {/* Upcoming */}
      <SectionHeading
        action={<Link href="/calendar" className="text-xs font-medium text-accent-ink hover:underline">Calendar</Link>}
      >
        Upcoming
      </SectionHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {countdowns.map((e) => {
          const days = diffDays(today, e.date);
          return (
            <Card key={e.id} className="relative overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: e.color }} />
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-3">{e.title}</p>
              <p className="mt-2 font-display text-3xl font-medium tabular-nums">
                {days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`}
              </p>
              <p className="mt-1 text-xs text-ink-3">{fmtDateShort(e.date)}</p>
            </Card>
          );
        })}
        {countdowns.length === 0 && (
          <Card className="sm:col-span-3">
            <p className="text-sm text-ink-2">
              No countdowns pinned. Pin up to three important dates from the{" "}
              <Link href="/calendar" className="font-medium text-accent-ink hover:underline">calendar</Link>.
            </p>
          </Card>
        )}
      </div>
      {upcoming.length > 0 && (
        <Card className="mt-3" pad={false}>
          <ul className="divide-y divide-line">
            {upcoming.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
                <span className="text-xs tabular-nums text-ink-3">{fmtDateShort(e.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Focus + trend */}
      <SectionHeading
        action={<Link href="/focus" className="text-xs font-medium text-accent-ink hover:underline">Start a session</Link>}
      >
        Focus & momentum
      </SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-ink-3">Focus today</p>
            <p className="mt-0.5 text-2xl font-semibold">{fmtMinutes(summary.focusMinutes)}</p>
            <p className="mt-1 text-xs text-ink-2">
              {summary.focusSessions
                ? `${summary.focusCompleted} completed · ${summary.focusInterrupted} interrupted`
                : "No sessions yet today"}
            </p>
          </div>
          <LinkButton href="/focus" variant="soft">
            Focus <IconArrowR size={15} />
          </LinkButton>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-3">Last 14 days · productivity score</p>
              <p className="mt-0.5 text-2xl font-semibold">
                {Math.round(
                  trend.filter((t) => t.scoreParts.length).reduce((s, t) => s + t.score, 0) /
                    Math.max(trend.filter((t) => t.scoreParts.length).length, 1)
                )}%
                <span className="ml-1 text-xs font-normal text-ink-3">avg</span>
              </p>
            </div>
            <Sparkline values={trend.map((t) => t.score)} width={140} height={44} />
          </div>
        </Card>
      </div>
    </div>
  );
}
