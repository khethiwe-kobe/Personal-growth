import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getGroupForUser } from "@/lib/auth";
import { sharedToday, sharedWeek, sharedMonth, sharedGoals } from "@/lib/repo";
import { fmtMinutes } from "@/lib/time";
import { PageTitle, Card, SectionHeading, Ring, Stat, ProgressBar, Chip } from "@/components/ui";
import Avatar from "@/components/Avatar";
import { IconFlame, IconLock } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function MemberPage({
  params,
}: { params: Promise<{ username: string }> }) {
  const user = await requireUser();
  const { username } = await params;
  const group = getGroupForUser(user.id);
  const member = group?.members.find(
    (m) => m.username.toLowerCase() === username.toLowerCase()
  );
  if (!member) notFound(); // only group members are visible — ever

  const today = sharedToday(member.id);
  const week = sharedWeek(member.id);
  const month = sharedMonth(member.id);
  const goals = sharedGoals(member.id);
  const isMe = member.id === user.id;

  return (
    <div className="fade-up mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={member.display_name} accent={member.accent}
          userId={member.id} hasAvatar={member.has_avatar} size={56} />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium">{member.display_name}</h1>
          <p className="text-sm text-ink-2">
            {member.role === "working" ? "Working" : "Student"}
            {member.bio && ` · ${member.bio}`}
          </p>
        </div>
        <div className="ml-auto">
          <Ring pct={today.score} size={64} stroke={6}
            label={<span className="text-sm font-semibold">{today.score}%</span>} sub="today" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><Stat label="Tasks today" value={`${today.tasksCompleted}/${today.tasksPlanned}`} /></Card>
        <Card><Stat label="Goals today" value={`${today.goalsCompleted}/${today.goalsDue}`} /></Card>
        <Card><Stat label="Focus this week" value={fmtMinutes(week.focusMinutes)} /></Card>
        <Card><Stat label="Streak" value={
          <span className="inline-flex items-center gap-1">
            {today.productiveStreak}d
            {today.productiveStreak > 0 && <IconFlame size={15} className="text-warn" />}
          </span>
        } /></Card>
      </div>

      <SectionHeading>This month</SectionHeading>
      <div className="grid grid-cols-3 gap-3">
        <Card><Stat label="Avg score" value={`${month.avgScore}%`} /></Card>
        <Card><Stat label="Goal completion" value={`${month.goalCompletion}%`} /></Card>
        <Card><Stat label="Days planned" value={month.daysPlanned} /></Card>
      </div>

      <SectionHeading>Goal progress</SectionHeading>
      {goals.length === 0 ? (
        <p className="text-sm text-ink-3">No shared goals.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((g) => (
            <Link key={g.goalId} href={`/accountability/${member.username}/goals/${g.goalId}`}
              className="block">
              <Card className="transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{g.title}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Chip color={g.categoryColor}>{g.categoryName}</Chip>
                      {g.status !== "active" && <Chip>{g.status}</Chip>}
                    </div>
                  </div>
                  <span className="text-lg font-semibold tabular-nums">{g.overallPct}%</span>
                </div>
                <ProgressBar className="mt-3" pct={g.overallPct} color={g.categoryColor} height={5} />
                <div className="mt-2 flex justify-between text-[11px] text-ink-3">
                  <span>{g.consistencyPct}% consistent</span>
                  {g.currentStreak > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-warn">
                      <IconFlame size={11} /> {g.currentStreak}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!isMe && (
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-3">
          <IconLock size={12} /> You're seeing {member.display_name.split(" ")[0]}'s shared numbers.
          Task names, schedules, notes and reflections stay private to them.
        </p>
      )}
      <p className="mt-6 text-xs">
        <Link href="/accountability" className="font-medium text-accent-ink hover:underline">← Group view</Link>
      </p>
    </div>
  );
}
