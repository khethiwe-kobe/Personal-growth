"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/useTransactions";
import type { Tx } from "@/lib/types";
import { byKind, sum } from "@/lib/money";
import { currentMonth, fmtR } from "@/lib/format";
import TxModal, { type TxPreset } from "@/components/TxModal";
import TxTable from "@/components/TxTable";
import { Button, Card, MonthNav, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { BarList } from "@/components/charts";

const PRESET: TxPreset = {
  kind: "transport",
  type: "expense",
  title: "Add transport expense",
  scope: "shared",
};

export default function TransportPage() {
  const { memberIds, nameOf } = useApp();
  const { txs, loading, upsert, remove } = useTransactions();
  const [ym, setYm] = useState(currentMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const rows = useMemo(() => byKind(txs, ym, "transport"), [txs, ym]);
  const total = sum(rows.map((t) => t.amount));

  const byType = useMemo(() => {
    const out = new Map<string, number>();
    for (const t of rows) {
      const key = t.meta.transport_type ?? "Other";
      out.set(key, (out.get(key) ?? 0) + t.amount);
    }
    return [...out.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const byPerson = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of rows) if (t.paid_by) out[t.paid_by] = (out[t.paid_by] ?? 0) + t.amount;
    return out;
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Transport"
        description="Uber, Bolt, petrol, public transport and other shared trips."
        actions={
          <>
            <MonthNav value={ym} onChange={setYm} />
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Add expense</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Spent this month" value={fmtR(total)} />
        {memberIds.slice(0, 2).map((id) => (
          <Stat key={id} label={`${nameOf(id)} paid`} value={fmtR(byPerson[id] ?? 0)} />
        ))}
      </div>

      {byType.length > 0 && (
        <Card className="mb-6">
          <SectionTitle>By type</SectionTitle>
          <BarList rows={byType} />
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <TxTable
          rows={rows}
          onEdit={(tx) => { setEditing(tx); setModalOpen(true); }}
          onDeleted={remove}
          emptyText="No transport expenses recorded this month yet."
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
