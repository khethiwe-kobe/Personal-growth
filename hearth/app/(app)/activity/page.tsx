"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import type { ActivityEntry } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import { Card, Empty, PageHeader } from "@/components/ui";

export default function ActivityPage() {
  const { sb, household, nameOf } = useApp();
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    if (!household) return;
    sb.from("activity_log")
      .select("*")
      .eq("household_id", household.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setEntries((data ?? []) as ActivityEntry[]));
  }, [sb, household]);

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Who changed what, and when — the household's audit trail."
      />
      {entries === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !entries.length ? (
        <Empty>No activity recorded yet.</Empty>
      ) : (
        <Card className="divide-y divide-border p-0">
          {entries.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <p className="text-sm">
                <span className="font-medium">{nameOf(e.user_id)}</span> {e.summary}
              </p>
              <p className="mt-0.5 text-xs text-faint">{fmtDateTime(e.created_at)}</p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
