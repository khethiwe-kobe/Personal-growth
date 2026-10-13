"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Empty, Page } from "@/components/Page";
import { useCoachState } from "@/lib/store";
import { PROFILE_LABELS, type Metric } from "@/lib/types";

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="text-accent">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.2" fill="currentColor" />
    </svg>
  );
}

/** Timed efforts over a distance improve when the number goes down. */
function lowerIsBetter(m: Metric): boolean {
  const timed = /^(s|sec|secs|seconds|min|mins|minutes|h|hours)$/i.test(m.unit.trim());
  const effort = /run|row|swim|sprint|march|ruck|walk|mile|km|time trial|shuttle|cycle|bike/i.test(`${m.key} ${m.label}`);
  return timed && effort;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function ProgressPage() {
  const { metrics, profile, logs } = useCoachState();

  const groups = useMemo(() => {
    const map = new Map<string, Metric[]>();
    for (const m of metrics) {
      const arr = map.get(m.key) ?? [];
      arr.push(m);
      map.set(m.key, arr);
    }
    return Array.from(map.values()).map((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));
  }, [metrics]);

  const profileEntries = Object.entries(profile);

  return (
    <Page title="Progress" intro="Baselines, reassessments and notable results your coach has recorded.">
      {groups.length === 0 ? (
        <Empty>
          Nothing measured yet. Baseline tests are set during the assessment; once you report results, they appear here and are
          reassessed every few weeks.{" "}
          <Link href="/" className="text-accent-ink underline">
            Back to the coach
          </Link>
          .
        </Empty>
      ) : (
        <section className="card overflow-hidden mb-6">
          <table className="data-table">
            <thead>
              <tr>
                <th>Test</th>
                <th className="text-right">Baseline</th>
                <th className="text-right">Latest</th>
                <th className="text-right">Change</th>
                <th className="hidden sm:table-cell">Trend</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const first = g[0];
                const last = g[g.length - 1];
                const delta = last.value - first.value;
                const pct = first.value !== 0 ? (delta / Math.abs(first.value)) * 100 : 0;
                const improved = lowerIsBetter(last) ? delta < 0 : delta > 0;
                const tone = delta === 0 || g.length < 2 ? "text-ink-3" : improved ? "text-ok" : "text-danger";
                return (
                  <tr key={first.key}>
                    <td>
                      <div className="font-medium">{last.label}</div>
                      <div className="text-xs text-ink-3">
                        {g.length} reading{g.length === 1 ? "" : "s"}
                        {last.note ? ` · ${last.note}` : ""}
                      </div>
                    </td>
                    <td className="text-right text-ink-2 whitespace-nowrap">
                      {fmt(first.value)} {first.unit}
                      <div className="text-xs text-ink-3">{first.date}</div>
                    </td>
                    <td className="text-right whitespace-nowrap font-medium">
                      {fmt(last.value)} {last.unit}
                      <div className="text-xs text-ink-3 font-normal">{last.date}</div>
                    </td>
                    <td className={`text-right whitespace-nowrap ${tone}`}>
                      {g.length > 1 ? `${delta > 0 ? "+" : ""}${fmt(delta)} (${pct > 0 ? "+" : ""}${pct.toFixed(0)}%)` : "–"}
                    </td>
                    <td className="hidden sm:table-cell">
                      <Sparkline values={g.map((m) => m.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        <section className="card p-5">
          <div className="label mb-3">Profile</div>
          {profileEntries.length === 0 ? (
            <p className="text-sm text-ink-3">Filled in by the coach during assessment.</p>
          ) : (
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {profileEntries.map(([k, v]) => (
                <div key={k}>
                  <dt className="label">{PROFILE_LABELS[k] ?? k.replace(/_/g, " ")}</dt>
                  <dd className="text-ink-2 mt-0.5 leading-relaxed">{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
        <section className="card p-5">
          <div className="label mb-3">Consistency</div>
          <div className="text-3xl serif">{logs.length}</div>
          <div className="text-sm text-ink-2">sessions logged</div>
          <div className="text-3xl serif mt-4">{logs.filter((l) => l.completed).length}</div>
          <div className="text-sm text-ink-2">completed in full</div>
          <div className="text-3xl serif mt-4">{logs.filter((l) => l.pain).length}</div>
          <div className="text-sm text-ink-2">with pain noted</div>
        </section>
      </div>
    </Page>
  );
}
