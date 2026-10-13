"use client";

import Link from "next/link";
import { Empty, Page } from "@/components/Page";
import { useCoachState } from "@/lib/store";
import { MetricsTable } from "@/components/MetricsTable";
import { PROFILE_LABELS } from "@/lib/types";

export default function ProgressPage() {
  const { metrics, profile, logs } = useCoachState();

  const profileEntries = Object.entries(profile);

  return (
    <Page title="Progress" intro="Baselines, reassessments and notable results your coach has recorded.">
      {metrics.length === 0 ? (
        <Empty>
          Nothing measured yet. Baseline tests are set during the assessment; once you report results, they appear here and are
          reassessed every few weeks.{" "}
          <Link href="/" className="text-accent-ink underline">
            Back to the coach
          </Link>
          .
        </Empty>
      ) : (
        <MetricsTable metrics={metrics} />
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
