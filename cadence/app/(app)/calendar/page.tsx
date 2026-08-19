import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { eventsFor, countdownEvents } from "@/lib/repo";
import {
  todayInTz, monthOf, monthDates, addMonths, weekdayIndex, fmtMonth,
  fmtDateLong, addDays, diffDays,
} from "@/lib/time";
import { PageTitle, Card, SectionHeading, EmptyState } from "@/components/ui";
import { IconChevronL, IconChevronR } from "@/components/icons";
import { AddEventForm, EventItem } from "@/components/EventForms";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const user = await requireUser();
  const today = todayInTz(user.timezone);
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? (sp.m as string) : monthOf(today);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? (sp.d as string) : today;

  const dates = monthDates(month);
  const gridStart = addDays(dates[0], -weekdayIndex(dates[0]));
  const cells: string[] = [];
  for (let d = gridStart; cells.length < 42; d = addDays(d, 1)) cells.push(d);
  const events = eventsFor(user.id, cells[0], cells[cells.length - 1]);
  const byDate = new Map<string, typeof events>();
  for (const e of events) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  const dayEvents = byDate.get(selected) ?? [];
  const pinned = countdownEvents(user.id, today);
  const pinnedSlots = pinned.map((p) => p.countdown_slot as number);
  const upcoming = events.filter((e) => e.date >= today).slice(0, 8);

  return (
    <div className="fade-up">
      <PageTitle title="Calendar" subtitle="Tests, deadlines, birthdays — everything that matters, in one place." />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-medium">{fmtMonth(month)}</h2>
            <div className="flex items-center gap-1">
              <Link href={`/calendar?m=${addMonths(month, -1)}`} aria-label="Previous month"
                className="rounded-lg border border-line p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
                <IconChevronL size={15} />
              </Link>
              <Link href={`/calendar`} className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink">
                Today
              </Link>
              <Link href={`/calendar?m=${addMonths(month, 1)}`} aria-label="Next month"
                className="rounded-lg border border-line p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
                <IconChevronR size={15} />
              </Link>
            </div>
          </div>
          <Card pad={false} className="overflow-hidden">
            <div className="grid grid-cols-7 border-b border-line text-center text-[10px] font-medium uppercase tracking-wide text-ink-3">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d) => {
                const inMonth = monthOf(d) === month;
                const evts = byDate.get(d) ?? [];
                const isSel = d === selected;
                const isToday = d === today;
                return (
                  <Link
                    key={d}
                    href={`/calendar?m=${month}&d=${d}`}
                    className={`min-h-[64px] border-b border-r border-line p-1.5 align-top text-xs transition-colors last:border-r-0 sm:min-h-[76px] ${
                      inMonth ? "" : "opacity-40"
                    } ${isSel ? "bg-accent-soft/60" : "hover:bg-surface-2"}`}
                  >
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full tabular-nums ${
                      isToday ? "bg-accent font-semibold text-white" : "text-ink-2"
                    }`}>
                      {Number(d.slice(8))}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {evts.slice(0, 2).map((e) => (
                        <div key={e.id} className="truncate rounded px-1 py-px text-[10px] leading-tight"
                          style={{ background: `color-mix(in oklab, ${e.color} 30%, var(--surface))` }}>
                          {e.title}
                        </div>
                      ))}
                      {evts.length > 2 && (
                        <div className="px-1 text-[9px] text-ink-3">+{evts.length - 2} more</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <SectionHeading>{fmtDateLong(selected)}</SectionHeading>
          <div className="mb-3">
            <AddEventForm date={selected} />
          </div>
          {dayEvents.length === 0 ? (
            <EmptyState title="Nothing on this day" />
          ) : (
            <Card pad={false}>
              <ul className="divide-y divide-line">
                {dayEvents.map((e) => (
                  <EventItem key={e.id} event={e} pinnedSlots={pinnedSlots} />
                ))}
              </ul>
            </Card>
          )}

          <SectionHeading>Coming up</SectionHeading>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ink-3">Nothing scheduled ahead this month.</p>
          ) : (
            <Card pad={false}>
              <ul className="divide-y divide-line">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link href={`/calendar?m=${monthOf(e.date)}&d=${e.date}`}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
                      <span className="min-w-0 flex-1 truncate">{e.title}</span>
                      <span className="text-xs tabular-nums text-ink-3">
                        {diffDays(today, e.date) === 0 ? "today" : `${diffDays(today, e.date)}d`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <p className="mt-3 text-[11px] text-ink-3">
            Pin up to three events as dashboard countdowns. Event notes stay private to you.
          </p>
        </div>
      </div>
    </div>
  );
}
