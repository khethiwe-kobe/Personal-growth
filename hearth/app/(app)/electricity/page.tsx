"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/useTransactions";
import type { Tx } from "@/lib/types";
import { byKind, electricitySummary, monthsInData, sum } from "@/lib/money";
import { currentMonth, fmtR, monthLabelShort } from "@/lib/format";
import TxModal, { type TxPreset } from "@/components/TxModal";
import TxTable from "@/components/TxTable";
import { Button, Card, MonthNav, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { TrendLine } from "@/components/charts";

const PRESET: TxPreset = {
  kind: "electricity",
  type: "expense",
  title: "Record electricity purchase",
  scope: "shared",
  defaultDescription: "Prepaid electricity",
};

export default function ElectricityPage() {
  const { memberIds, nameOf } = useApp();
  const { txs, loading, upsert, remove } = useTransactions();
  const [ym, setYm] = useState(currentMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const rows = useMemo(() => byKind(txs, ym, "electricity"), [txs, ym]);
  const s = useMemo(() => electricitySummary(txs, ym), [txs, ym]);

  const byPerson = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of rows) if (t.paid_by) out[t.paid_by] = (out[t.paid_by] ?? 0) + t.amount;
    return out;
  }, [rows]);

  const trend = useMemo(
    () =>
      monthsInData(txs, ym)
        .slice(-6)
        .map((m) => ({
          label: monthLabelShort(m),
          value: sum(byKind(txs, m, "electricity").map((t) => t.amount)),
        })),
    [txs, ym],
  );

  return (
    <div>
      <PageHeader
        title="Electricity"
        description="Every prepaid purchase, with units received and cost per kWh."
        actions={
          <>
            <MonthNav value={ym} onChange={setYm} />
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Record purchase</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Spent this month" value={fmtR(s.rand)} />
        <Stat label="Units purchased" value={`${s.kwh} kWh`} />
        <Stat label="Average cost" value={s.perKwh != null ? `${fmtR(s.perKwh)}/kWh` : "—"} />
        <Stat
          label="By person"
          value={memberIds.map((id) => `${nameOf(id)} ${fmtR(byPerson[id] ?? 0)}`).join(" · ") || "—"}
        />
      </div>

      <Card className="mb-6">
        <SectionTitle>Spending over time</SectionTitle>
        <TrendLine points={trend} />
      </Card>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <TxTable
          rows={rows}
          onEdit={(tx) => { setEditing(tx); setModalOpen(true); }}
          onDeleted={remove}
          emptyText="No electricity purchases recorded this month yet."
        />
      )}

      <TxModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        preset={PRESET}
        existing={editing}
        onSaved={upsert}
      />
    </div>
  );
}
