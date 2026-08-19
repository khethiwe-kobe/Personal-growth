"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/useTransactions";
import type { Tx } from "@/lib/types";
import { rentCoverage, sum } from "@/lib/money";
import { currentMonth, fmtR, monthLabel } from "@/lib/format";
import TxModal, { type TxPreset } from "@/components/TxModal";
import TxTable from "@/components/TxTable";
import { Button, Card, MonthNav, PageHeader, SectionTitle, Stat, Tag } from "@/components/ui";

export default function RentPage() {
  const { household, memberIds, nameOf } = useApp();
  const { txs, loading, upsert, remove } = useTransactions();
  const [ym, setYm] = useState(currentMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const rentTxs = useMemo(
    () =>
      txs.filter(
        (t) => t.kind === "rent" && (t.meta.month ?? t.occurred_on.slice(0, 7)) === ym,
      ),
    [txs, ym],
  );
  const coverage = useMemo(() => rentCoverage(txs, ym), [txs, ym]);
  const paidTotal = sum(rentTxs.map((t) => t.amount));

  if (!household) return null;

  const preset: TxPreset = {
    kind: "rent",
    type: "expense",
    title: "Record rent payment",
    scope: "shared",
    lockScope: true,
    defaultAmount: household.rent_per_person,
    defaultDescription: `Rent — ${monthLabel(ym)}`,
  };

  return (
    <div>
      <PageHeader
        title="Rent"
        description={`${fmtR(household.rent_per_person)} per person, ${fmtR(household.rent_total)} total. Amounts can be changed in Settings.`}
        actions={
          <>
            <MonthNav value={ym} onChange={setYm} />
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Record payment</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Recorded this month" value={fmtR(paidTotal)} sub={`of ${fmtR(household.rent_total)} total rent`} />
        {memberIds.slice(0, 2).map((id) => {
          const covered = coverage[id] ?? 0;
          const ok = covered >= household.rent_per_person - 0.01;
          return (
            <Stat
              key={id}
              label={`${nameOf(id)} — share covered`}
              value={fmtR(covered)}
              tone={ok ? "good" : "warn"}
              sub={ok ? "Fully covered" : `Outstanding ${fmtR(Math.max(0, household.rent_per_person - covered))}`}
            />
          );
        })}
      </div>

      <Card className="mb-6">
        <SectionTitle>How rent is counted</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">
          Record your own share with the split set to <Tag>Own share</Tag>. If one person
          pays the full {fmtR(household.rent_total)}, use <Tag>50/50</Tag> — both shares are
          then covered and the difference shows up in the who-owes-who balance.
        </p>
      </Card>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <TxTable
          rows={rentTxs}
          onEdit={(tx) => { setEditing(tx); setModalOpen(true); }}
          onDeleted={remove}
          emptyText={`No rent payments recorded for ${monthLabel(ym)} yet.`}
        />
      )}

      <TxModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        preset={preset}
        existing={editing}
        onSaved={upsert}
      />
    </div>
  );
}
