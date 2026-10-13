"use client";

import Link from "next/link";
import { Empty, Page } from "@/components/Page";
import { useCoachState } from "@/lib/store";

export default function ProgrammePage() {
  const { programme } = useCoachState();

  if (!programme) {
    return (
      <Page title="Programme">
        <Empty>
          Your programme appears here once the coach has finished the assessment and built it. Until then,{" "}
          <Link href="/" className="text-accent-ink underline">
            continue the conversation
          </Link>
          .
        </Empty>
      </Page>
    );
  }

  const weekday = new Date().toLocaleDateString("en-GB", { weekday: "long" }).toLowerCase();

  return (
    <Page
      title={programme.title}
      intro={programme.summary}
      aside={
        <div className="text-xs text-ink-3 text-right">
          {programme.total_weeks ? <div>{programme.total_weeks} weeks</div> : null}
          {programme.start_date ? <div>From {programme.start_date}</div> : null}
          <div>Updated {new Date(programme.updated_at).toLocaleDateString("en-GB")}</div>
        </div>
      }
    >
      <section className="card overflow-hidden mb-6">
        <div className="px-5 pt-5 pb-2 label">Weekly schedule</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Session</th>
              <th>Focus</th>
              <th className="text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {programme.schedule.map((d, i) => {
              const isToday = d.day.toLowerCase() === weekday;
              return (
                <tr key={i} className={isToday ? "bg-accent-soft/50" : ""}>
                  <td className="whitespace-nowrap font-medium">{d.day}</td>
                  <td>{d.session}</td>
                  <td className="text-ink-2">{d.focus}</td>
                  <td className="text-right whitespace-nowrap text-ink-2">{d.duration_min} min</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="grid md:grid-cols-2 gap-4 mb-6">
        {programme.blocks.map((b, i) => (
          <div key={i} className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-lg">{b.name}</h3>
              <span className="text-xs text-ink-3 whitespace-nowrap">Weeks {b.weeks}</span>
            </div>
            <p className="text-ink-2 mt-2 text-sm leading-relaxed">{b.focus}</p>
            {b.notes && <p className="text-ink-3 mt-2 text-sm leading-relaxed">{b.notes}</p>}
          </div>
        ))}
      </section>

      {programme.principles.length > 0 && (
        <section className="card p-5">
          <div className="label mb-3">Principles</div>
          <ul className="flex flex-col gap-2 text-sm text-ink-2 leading-relaxed list-disc pl-5">
            {programme.principles.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
