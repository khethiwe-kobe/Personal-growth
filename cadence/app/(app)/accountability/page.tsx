import Link from "next/link";
import { requireUser, getGroupForUser } from "@/lib/auth";
import { sharedToday, sharedWeek, sharedMonth } from "@/lib/repo";
import { todayInTz, startOfWeek, addDays, fmtMinutes, fmtMonth, monthOf, addMonths } from "@/lib/time";
import { PageTitle, Card, SectionHeading, ProgressBar, Trend } from "@/components/ui";
import Avatar from "@/components/Avatar";
import { IconFlame, IconLock } from "@/components/icons";

export const metadata = { title: "Accountability" };
export const dynamic = "force-dynamic";

export default async function AccountabilityPage() {
  const user = await requireUser();
  const group = getGroupForUser(user.id);
  if (!group) {
    return (
      <div className="fade-up">
        <PageTitle title="Accountability" />
        <p className="text-sm text-ink-2">You're not in a group yet. Ask a friend for their invite code.</p>
      </div>
    );
  }
  const today = todayInTz(user.timezone);
  const rows = group.members.map((m) => ({
    member: m,
    today: sharedToday(m.id),
    week: sharedWeek(m.id),
    lastWeek: sharedWeek(m.id, addDays(startOfWeek(todayInTz(m.timezone)), -7)),
    month: sharedMonth(m.id),
    lastMonth: sharedMonth(m.id, addMonths(monthOf(todayInTz(m.timezone)), -1)),
  }));

  // Awards — improvement matters as much as raw score.
  const by = <T,>(arr: typeof rows, f: (r: (typeof rows)[0]) => number) =>
    [...arr].sort((a, b) => f(b) - f(a))[0];
  const awards: { title: string; r: (typeof rows)[0]; detail: string }[] = [];
  const consistent = by(rows, (r) => r.week.goalConsistency);
  if (consistent.week.goalConsistency > 0)
    awards.push({ title: "Most consistent this week", r: consistent, detail: `${consistent.week.goalConsistency}% of goal targets met` });
  const improved = by(rows, (r) => r.week.avgScore - r.lastWeek.avgScore);
  if (improved.week.avgScore - improved.lastWeek.avgScore > 0)
    awards.push({ title: "Most improved", r: improved, detail: `+${improved.week.avgScore - improved.lastWeek.avgScore} pts vs last week` });
  const streaky = by(rows, (r) => r.today.productiveStreak);
  if (streaky.today.productiveStreak > 1)
    awards.push({ title: "Longest streak", r: streaky, detail: `${streaky.today.productiveStreak} productive days` });
  const focused = by(rows, (r) => r.week.focusMinutes);
  if (focused.week.focusMinutes > 0)
    awards.push({ title: "Most focus hours", r: focused, detail: `${fmtMinutes(focused.week.focusMinutes)} this week` });
  const goalie = by(rows, (r) => r.month.goalCompletion);
  if (goalie.month.goalCompletion > 0)
    awards.push({ title: "Best goal completion", r: goalie, detail: `${goalie.month.goalCompletion}% this month` });

  return (
    <div className="fade-up">
      <PageTitle
        title="Accountability"
        subtitle="Three people, one standard. Numbers only — never each other's private plans."
      />

      {awards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {awards.slice(0, 6).map((a) => (
            <Card key={a.title} className="flex items-center gap-3">
              <Avatar name={a.r.member.display_name} accent={a.r.member.accent}
                userId={a.r.member.id} hasAvatar={a.r.member.has_avatar} size={34} />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">{a.title}</p>
                <p className="truncate text-sm font-semibold">{a.r.member.display_name}</p>
                <p className="truncate text-xs text-ink-2">{a.detail}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SectionHeading>Today</SectionHeading>
      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-3 py-2.5 font-medium">Completion</th>
              <th className="px-3 py-2.5 font-medium">Tasks</th>
              <th className="px-3 py-2.5 font-medium">Goals</th>
              <th className="px-3 py-2.5 font-medium">Planned</th>
              <th className="px-3 py-2.5 font-medium">Done</th>
              <th className="px-3 py-2.5 font-medium">Focus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member, today: t }) => (
              <tr key={member.id} className={`border-b border-line last:border-0 ${member.id === user.id ? "bg-accent-soft/30" : ""}`}>
                <td className="px-4 py-3">
                  <Link href={`/accountability/${member.username}`} className="flex items-center gap-2 font-medium hover:underline">
                    <Avatar name={member.display_name} accent={member.accent}
                      userId={member.id} hasAvatar={member.has_avatar} size={26} />
                    {member.display_name}{member.id === user.id && <span className="text-xs text-ink-3">(you)</span>}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={t.score} className="w-16" height={5} />
                    <span className="tabular-nums text-xs">{t.score}%</span>
                  </div>
                </td>
                <td className="px-3 py-3 tabular-nums">{t.tasksCompleted}/{t.tasksPlanned}</td>
                <td className="px-3 py-3 tabular-nums">{t.goalsCompleted}/{t.goalsDue}</td>
                <td className="px-3 py-3 tabular-nums">{fmtMinutes(t.plannedMinutes)}</td>
                <td className="px-3 py-3 tabular-nums">{fmtMinutes(t.completedMinutes)}</td>
                <td className="px-3 py-3 tabular-nums">{fmtMinutes(t.focusMinutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SectionHeading>This week</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map(({ member, week, lastWeek, today: t }) => (
          <Card key={member.id}>
            <div className="flex items-center gap-2.5">
              <Avatar name={member.display_name} accent={member.accent}
                userId={member.id} hasAvatar={member.has_avatar} size={30} />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{member.display_name}</p>
              <Trend delta={week.avgScore - lastWeek.avgScore} suffix=" pts" />
            </div>
            <div className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-ink-3">Avg completion</span>
                <span className="font-medium tabular-nums">{week.avgCompletion}%</span></div>
              <div className="flex justify-between"><span className="text-ink-3">Goal consistency</span>
                <span className="font-medium tabular-nums">{week.goalConsistency}%</span></div>
              <div className="flex justify-between"><span className="text-ink-3">Focus</span>
                <span className="font-medium tabular-nums">{fmtMinutes(week.focusMinutes)}</span></div>
              <div className="flex justify-between"><span className="text-ink-3">Streak</span>
                <span className="inline-flex items-center gap-1 font-medium tabular-nums">
                  {t.productiveStreak > 0 && <IconFlame size={12} className="text-warn" />}
                  {t.productiveStreak}d
                </span></div>
            </div>
          </Card>
        ))}
      </div>

      <SectionHeading>{fmtMonth(monthOf(today))}</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map(({ member, month, lastMonth }) => (
          <Card key={member.id}>
            <div className="flex items-center gap-2.5">
              <Avatar name={member.display_name} accent={member.accent}
                userId={member.id} hasAvatar={member.has_avatar} size={30} />
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{member.display_name}</p>
              <Trend delta={month.avgScore - lastMonth.avgScore} suffix=" pts" />
            </div>
            <div className="mt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-ink-3">Avg score</span>
                <span className="font-medium tabular-nums">{month.avgScore}%</span></div>
              <div className="flex justify-between"><span className="text-ink-3">Goal completion</span>
                <span className="font-medium tabular-nums">{month.goalCompletion}%</span></div>
              <div className="flex justify-between"><span className="text-ink-3">Days planned</span>
                <span className="font-medium tabular-nums">{month.daysPlanned}</span></div>
              <div className="flex justify-between"><span className="text-ink-3">Monthly review</span>
                <span className={`font-medium ${month.reviewSubmitted ? "text-ok" : "text-ink-3"}`}>
                  {month.reviewSubmitted ? "submitted" : "not yet"}
                </span></div>
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-3">
        <IconLock size={12} /> Rankings compare effort and improvement, not worth. The only real
        competition is with last week's you.
      </p>
    </div>
  );
}
