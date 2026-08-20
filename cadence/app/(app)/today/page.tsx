import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  tasksForDay, blocksForDay, categoriesFor, daySummaryFor, nowMinutesInTz,
  goalsDueToday, timetableFor,
} from "@/lib/repo";
import { todayInTz, addDays, fmtDateLong, fmtMinutes } from "@/lib/time";
import { Card, SectionHeading, ProgressBar, EmptyState, Stat } from "@/components/ui";
import { IconChevronL, IconChevronR } from "@/components/icons";
import TaskItem from "@/components/TaskItem";
import Timeline from "@/components/Timeline";
import ShareDay from "@/components/ShareDay";
import { AddTaskForm, AddBlockForm } from "@/components/TodayForms";
import { CheckinRow } from "@/components/GoalCheckin";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? (sp.date as string) : today;
  const isToday = date === today;
  const isPast = date < today;

  const [tasks, blocks, categories, summary, goals, timetable] = await Promise.all([
    tasksForDay(user.id, date),
    blocksForDay(user.id, date),
    categoriesFor(user.id),
    daySummaryFor(user.id, date, user.timezone),
    isToday ? goalsDueToday(user.id, today) : Promise.resolve(null),
    timetableFor(user.id),
  ]);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const hasTimetable = timetable.length > 0;
  const nowMin = isToday ? nowMinutesInTz(user.timezone) : null;

  const order = { A: 0, B: 1, C: 2 } as const;
  const sorted = [...tasks].sort((a, b) => {
    if (!!a.completed !== !!b.completed) return a.completed ? 1 : -1;
    if (a.start_min !== null && b.start_min !== null) return a.start_min - b.start_min;
    if ((a.start_min === null) !== (b.start_min === null)) return a.start_min === null ? 1 : -1;
    return order[a.priority] - order[b.priority];
  });

  return (
    <div className="fade-up">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href={`/today?date=${addDays(date, -1)}`} aria-label="Previous day"
              className="rounded-lg border border-line p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
              <IconChevronL size={15} />
            </Link>
            <h1 className="font-display text-xl font-medium sm:text-2xl">
              {isToday ? "Today" : fmtDateLong(date)}
            </h1>
            <Link href={`/today?date=${addDays(date, 1)}`} aria-label="Next day"
              className="rounded-lg border border-line p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
              <IconChevronR size={15} />
            </Link>
            {!isToday && (
              <Link href="/today" className="ml-1 text-xs font-medium text-accent-ink hover:underline">
                Back to today
              </Link>
            )}
          </div>
          {isToday && <p className="mt-1 text-sm text-ink-3">{fmtDateLong(date)}</p>}
        </div>
        <div className="flex items-center gap-5 text-sm">
          <Stat label="Done" value={`${summary.tasksCompleted}/${summary.tasksPlanned}`} />
          <Stat label="Planned" value={fmtMinutes(summary.plannedMinutes)} />
          <Stat label="Unaccounted" value={fmtMinutes(summary.unaccountedMinutes)} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AddTaskForm date={date} categories={categories} hasTimetable={hasTimetable} />

          {goals && goals.items.length > 0 && (
            <>
              <SectionHeading>Daily goals due today</SectionHeading>
              <Card pad={false}>
                <ul className="divide-y divide-line">
                  {goals.items.map(({ goal, stats }) => (
                    <li key={goal.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <Link href={`/goals/${goal.id}`} className="text-sm font-medium hover:underline">
                          {goal.title}
                        </Link>
                        <p className="text-xs text-ink-3">
                          Target: {stats.todayTarget}{goal.unit ? ` ${goal.unit}` : ""} today
                        </p>
                      </div>
                      <CheckinRow
                        goalId={goal.id} date={today} value={stats.todayValue}
                        target={stats.todayTarget as number} trackingType={goal.tracking_type}
                        unit={goal.unit} minimum={goal.minimum_target}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}

          <SectionHeading>
            Tasks {summary.overdueTasks > 0 && (
              <span className="ml-2 normal-case tracking-normal text-danger">
                {summary.overdueTasks} overdue
              </span>
            )}
          </SectionHeading>
          {sorted.length === 0 ? (
            <EmptyState
              title={isPast ? "Nothing was planned this day" : "No tasks yet"}
              hint={isPast ? undefined : "Plan the day before the day plans you."}
            />
          ) : (
            <Card pad={false}>
              <ul className="divide-y divide-line">
                {sorted.map((t) => (
                  <TaskItem
                    key={t.id} task={t}
                    category={t.category_id ? catMap.get(t.category_id) ?? null : null}
                    categories={categories} isPast={isPast}
                  />
                ))}
              </ul>
            </Card>
          )}
          {summary.completionPct > 0 && (
            <div className="mt-3">
              <ProgressBar pct={summary.completionPct} height={5} />
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <SectionHeading>Your 24 hours</SectionHeading>
          <Card>
            <Timeline tasks={tasks} blocks={blocks} categories={categories} nowMin={nowMin} />
            <div className="mt-3 border-t border-line pt-3">
              <AddBlockForm date={date} />
            </div>
          </Card>
          <ShareDay date={date} />
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            Every one of the 24 hours counts, midnight to midnight — sleep included. Log
            it and it is accounted for: sleep, breaks, rest and travel all count. Not every
            minute has to be &quot;productive&quot;, it just has to be intentional. The figure at
            the top of the page counts only the hours that have already passed today; the
            timeline covers the whole day.
          </p>
        </div>
      </div>
    </div>
  );
}
