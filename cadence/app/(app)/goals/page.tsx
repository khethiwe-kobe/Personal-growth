import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { allGoalStats, categoriesFor } from "@/lib/repo";
import { todayInTz } from "@/lib/time";
import { trimNum } from "@/lib/goals";
import { PageTitle, Card, ProgressBar, Chip, EmptyState, LinkButton, SectionHeading } from "@/components/ui";
import { IconFlame, IconPlus } from "@/components/icons";
import { CheckinRow } from "@/components/GoalCheckin";

export const metadata = { title: "Goals" };
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const [goals, categories] = await Promise.all([
    allGoalStats(user.id, today),
    categoriesFor(user.id),
  ]);
  const cats = new Map(categories.map((c) => [c.id, c]));

  const active = goals.filter((g) => g.goal.status === "active");
  const paused = goals.filter((g) => g.goal.status === "paused");
  const completed = goals.filter((g) => g.goal.status === "completed");

  return (
    <div className="fade-up">
      <PageTitle
        title="Goals"
        subtitle="Measurable, scheduled, tracked — not wishes."
        action={<LinkButton href="/goals/new" variant="primary"><IconPlus size={15} /> New goal</LinkButton>}
      />

      {active.length === 0 && paused.length === 0 && completed.length === 0 && (
        <EmptyState
          title="No goals yet"
          hint="The guided setup turns a vague intention into a measurable commitment in under two minutes."
          action={<LinkButton href="/goals/new" variant="soft">Create your first goal</LinkButton>}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {active.map(({ goal, stats }) => {
          const cat = goal.category_id ? cats.get(goal.category_id) : undefined;
          const periodPct = stats.currentPeriod
            ? Math.min(100, (stats.currentPeriod.value / Math.max(stats.currentPeriod.target, 0.001)) * 100)
            : 0;
          return (
            <Card key={goal.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/goals/${goal.id}`} className="block truncate text-[15px] font-semibold hover:underline">
                    {goal.title}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {cat && <Chip color={cat.color}>{cat.name}</Chip>}
                    <Chip>{goal.frequency}</Chip>
                    {!goal.share_progress && <Chip>private</Chip>}
                    {stats.currentStreak > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-warn">
                        <IconFlame size={13} /> {stats.currentStreak}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold tabular-nums">{stats.overallPct}%</div>
                  <div className="text-[10px] text-ink-3">overall</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-ink-3">
                  <span>
                    {goal.frequency === "daily" ? "Today" : goal.frequency === "weekly" ? "This week" : "This month"}
                    {stats.currentPeriod &&
                      ` · ${trimNum(stats.currentPeriod.value)}/${trimNum(stats.currentPeriod.target)}${goal.unit ? ` ${goal.unit}` : ""}`}
                  </span>
                  <span>{stats.consistencyPct}% consistent</span>
                </div>
                <ProgressBar pct={periodPct} color={cat?.color} />
              </div>
              {stats.todayTarget !== null && (
                <div className="mt-4 border-t border-line pt-3">
                  <CheckinRow
                    goalId={goal.id} date={today} value={stats.todayValue}
                    target={stats.todayTarget} trackingType={goal.tracking_type}
                    unit={goal.unit} minimum={goal.minimum_target}
                  />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {paused.length > 0 && (
        <>
          <SectionHeading>Paused</SectionHeading>
          <div className="grid gap-3 lg:grid-cols-2">
            {paused.map(({ goal, stats }) => (
              <Card key={goal.id} className="opacity-70">
                <div className="flex items-center justify-between">
                  <Link href={`/goals/${goal.id}`} className="text-sm font-medium hover:underline">{goal.title}</Link>
                  <span className="text-xs text-ink-3">{stats.overallPct}% · paused</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {completed.length > 0 && (
        <>
          <SectionHeading>Completed</SectionHeading>
          <div className="grid gap-3 lg:grid-cols-2">
            {completed.map(({ goal, stats }) => (
              <Card key={goal.id}>
                <div className="flex items-center justify-between">
                  <Link href={`/goals/${goal.id}`} className="text-sm font-medium hover:underline">{goal.title}</Link>
                  <span className="text-xs font-medium text-ok">
                    done · best streak {stats.longestStreak}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
