import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getGroupForUser } from "@/lib/auth";
import { sharedGoals } from "@/lib/repo";
import { trimNum } from "@/lib/goals";
import { PageTitle, Card, Ring, Stat, Chip, SectionHeading } from "@/components/ui";
import Avatar from "@/components/Avatar";
import { IconFlame, IconLock } from "@/components/icons";

export const dynamic = "force-dynamic";

/** Shared goal drill-down: aggregate numbers only, never notes/why/evidence. */
export default async function SharedGoalPage({
  params,
}: { params: Promise<{ username: string; goalId: string }> }) {
  const user = await requireUser();
  const { username, goalId } = await params;
  const group = getGroupForUser(user.id);
  const member = group?.members.find(
    (m) => m.username.toLowerCase() === username.toLowerCase()
  );
  if (!member) notFound();
  const goal = sharedGoals(member.id).find((g) => g.goalId === Number(goalId));
  if (!goal) notFound();

  const per = goal.frequency === "daily" ? "day" : goal.frequency === "weekly" ? "week" : "month";

  return (
    <div className="fade-up mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={member.display_name} accent={member.accent}
          userId={member.id} hasAvatar={member.has_avatar} size={40} />
        <div>
          <p className="text-xs text-ink-3">{member.display_name}</p>
          <h1 className="font-display text-2xl font-medium">{goal.title}</h1>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip color={goal.categoryColor}>{goal.categoryName}</Chip>
        <Chip>{goal.frequency}</Chip>
        <Chip>{trimNum(goal.periodTarget)}{goal.unit ? ` ${goal.unit}` : ""} / {per}</Chip>
        {goal.status !== "active" && <Chip>{goal.status}</Chip>}
      </div>

      <Card className="flex items-center gap-6">
        <Ring pct={goal.overallPct} size={110} sub="overall" />
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-4">
          <Stat label="Consistency" value={`${goal.consistencyPct}%`} />
          <Stat label="Current streak" value={
            <span className="inline-flex items-center gap-1">
              {goal.currentStreak}
              {goal.currentStreak > 0 && <IconFlame size={15} className="text-warn" />}
            </span>
          } />
          <Stat label="Longest streak" value={goal.longestStreak} />
          <Stat label="This week" value={`${trimNum(goal.weekValue)}/${trimNum(goal.weekTarget)}`}
            sub={goal.unit || undefined} />
        </div>
      </Card>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-3">
        <IconLock size={12} /> The why, notes and evidence behind this goal are private to {member.display_name.split(" ")[0]}.
      </p>
      <p className="mt-6 text-xs">
        <Link href={`/accountability/${member.username}`} className="font-medium text-accent-ink hover:underline">
          ← {member.display_name}
        </Link>
      </p>
    </div>
  );
}
