"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Feed } from "@/components/Feed";
import { MetricsTable } from "@/components/MetricsTable";
import { Page } from "@/components/Page";
import { api } from "@/lib/api";
import type { ScoreRow } from "@/lib/scoring";
import type { PublicProgress } from "@/lib/types";

type MemberData = {
  member: { id: string; name: string; joinedAt: string };
  progress: PublicProgress;
  week: Omit<ScoreRow, "rank">;
  all: Omit<ScoreRow, "rank">;
};

export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<MemberData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MemberData>(`/api/members/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this member."));
  }, [id]);

  if (error) {
    return (
      <Page title="Member">
        <div className="text-sm text-ink-2 bg-surface-2 rounded-lg px-3 py-2">{error}</div>
      </Page>
    );
  }
  if (!data) return <Page title="">{<div className="text-sm text-ink-3">Loading…</div>}</Page>;

  const { member, progress, week, all } = data;
  const recent = [...progress.logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <Page
      title={member.name}
      intro={progress.programme ? `Training on: ${progress.programme.title}` : "No programme yet."}
      aside={
        <Link href="/team" className="text-sm text-ink-3 hover:text-ink">
          Back to the team
        </Link>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Points this week" value={week.points} />
        <Stat label="Points all time" value={all.points} />
        <Stat label="This week" value={`${week.thisWeekSessions}/${week.plannedPerWeek}`} />
        <Stat label="Week streak" value={all.weekStreak ? `${all.weekStreak} wk` : "–"} />
      </div>

      {progress.metrics.length > 0 && <MetricsTable metrics={progress.metrics} />}

      {recent.length > 0 && (
        <section className="card overflow-hidden mb-6">
          <div className="px-5 pt-4 pb-1 label">Recent sessions</div>
          <table className="data-table">
            <tbody>
              {recent.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-ink-3">{l.date}</td>
                  <td className="font-medium">{l.session}</td>
                  <td className="text-ink-2 text-sm">
                    {l.exercises
                      .slice(0, 4)
                      .map((e) => [e.name, e.load].filter(Boolean).join(" "))
                      .join(", ")}
                  </td>
                  <td className="text-right text-xs">{l.completed ? <span className="text-ok">Done</span> : <span className="text-ink-3">Partial</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="label mb-3">Posts</div>
      <div className="max-w-2xl">
        <Feed memberId={member.id} />
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="serif text-2xl mt-1">{value}</div>
    </div>
  );
}
