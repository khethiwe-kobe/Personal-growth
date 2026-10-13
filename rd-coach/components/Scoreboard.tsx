"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/store";
import type { POINTS as PointsTable, ScoreRow } from "@/lib/scoring";

type Board = { today: string; points: typeof PointsTable; week: ScoreRow[]; all: ScoreRow[] };

function pct(n: number | null) {
  if (n === null) return "–";
  return `${n > 0 ? "+" : ""}${n.toFixed(0)}%`;
}

export function Scoreboard() {
  const me = useMe();
  const [board, setBoard] = useState<Board | null>(null);
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Board>("/api/scoreboard")
      .then(setBoard)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the scoreboard."));
  }, []);

  if (error) return <div className="text-sm text-ink-2 bg-surface-2 rounded-lg px-3 py-2">{error}</div>;
  if (!board) return <div className="text-sm text-ink-3 px-1">Loading…</div>;

  const rows = board[period];
  const all = board.all;
  const streakLeader = [...all].sort((a, b) => b.weekStreak - a.weekStreak)[0];
  const improver = [...all].filter((r) => r.improvement !== null).sort((a, b) => (b.improvement ?? 0) - (a.improvement ?? 0))[0];
  const P = board.points;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Highlight label="Leading this week" value={board.week[0]?.points ? board.week[0].name : "Nobody yet"} detail={board.week[0]?.points ? `${board.week[0].points} points` : "First session takes it"} />
        <Highlight
          label="Longest week streak"
          value={streakLeader?.weekStreak ? streakLeader.name : "Nobody yet"}
          detail={streakLeader?.weekStreak ? `${streakLeader.weekStreak} week${streakLeader.weekStreak === 1 ? "" : "s"} on target` : "Hit your weekly target to start one"}
        />
        <Highlight
          label="Most improved"
          value={improver && (improver.improvement ?? 0) > 0 ? improver.name : "Nobody yet"}
          detail={improver && (improver.improvement ?? 0) > 0 ? `${pct(improver.improvement)} across their tests` : "Needs a second test result"}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="label">Scoreboard</div>
          <div className="flex rounded-lg border border-line-2 overflow-hidden text-xs">
            {(["week", "all"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 ${period === p ? "bg-accent text-surface" : "text-ink-2 hover:bg-surface-2"}`}>
                {p === "week" ? "This week" : "All time"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Name</th>
                <th className="text-right">Points</th>
                <th className="text-right">Sessions</th>
                <th className="text-right hidden sm:table-cell">This week</th>
                <th className="text-right">Streak</th>
                <th className="text-right hidden sm:table-cell">Photos</th>
                <th className="text-right hidden sm:table-cell">Bests</th>
                <th className="text-right hidden md:table-cell">Improved</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.id === me?.id ? "bg-accent-soft/50" : ""}>
                  <td className="text-ink-3 whitespace-nowrap">
                    {r.rank <= 3 && r.points > 0 && (
                      <span
                        aria-hidden
                        className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                        style={{ background: ["#b8913a", "#9aa0a6", "#a8724a"][r.rank - 1] }}
                      />
                    )}
                    {r.rank}
                  </td>
                  <td>
                    <Link href={`/team/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    {r.id === me?.id && <span className="text-xs text-ink-3 ml-1.5">you</span>}
                  </td>
                  <td className="text-right font-medium">{r.points}</td>
                  <td className="text-right text-ink-2">{r.sessions}</td>
                  <td className="text-right text-ink-2 hidden sm:table-cell">
                    {r.thisWeekSessions}/{r.plannedPerWeek}
                  </td>
                  <td className="text-right text-ink-2">{r.weekStreak ? `${r.weekStreak} wk` : "–"}</td>
                  <td className="text-right text-ink-2 hidden sm:table-cell">{r.photos}</td>
                  <td className="text-right text-ink-2 hidden sm:table-cell">{r.bests}</td>
                  <td className={`text-right hidden md:table-cell ${(r.improvement ?? 0) > 0 ? "text-ok" : "text-ink-3"}`}>{pct(r.improvement)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details className="card p-5 text-sm text-ink-2">
        <summary className="cursor-pointer text-ink font-medium">How points work</summary>
        <ul className="mt-3 flex flex-col gap-1.5 list-disc pl-5 leading-relaxed">
          <li>
            Completed session: {P.completedSession} points. Partly completed: {P.partialSession}. Up to {P.maxSessionsPerDay} sessions count per day.
          </li>
          <li>Progress photo: {P.photoDay} points per day you post one.</li>
          <li>
            New personal best on a tracked test: {P.personalBest} points. First baseline for a test: {P.baseline}.
          </li>
          <li>Streak: weeks in a row in which you did all the sessions your programme plans for that week. Rest days never break it.</li>
          <li>Improved: the average change from your first to your latest result across all your tests.</li>
          <li>Weeks run Monday to Sunday, Johannesburg time.</li>
        </ul>
      </details>
    </div>
  );
}

function Highlight({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="serif text-xl mt-1.5">{value}</div>
      <div className="text-xs text-ink-3 mt-0.5">{detail}</div>
    </div>
  );
}
