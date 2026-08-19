"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/useTransactions";
import type { GroceryItem, Tx } from "@/lib/types";
import { normGroceryItem } from "@/lib/types";
import { byKind, sum } from "@/lib/money";
import { currentMonth, fmtR } from "@/lib/format";
import TxModal, { type TxPreset } from "@/components/TxModal";
import TxTable from "@/components/TxTable";
import { Button, Card, MonthNav, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { BarList } from "@/components/charts";

const PRESET: TxPreset = {
  kind: "grocery",
  type: "expense",
  title: "Record grocery shop",
  scope: "shared",
};

export default function GroceriesPage() {
  const { sb, household, memberIds, nameOf } = useApp();
  const { txs, loading, upsert, remove } = useTransactions();
  const [ym, setYm] = useState(currentMonth());
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  useEffect(() => {
    if (!household) return;
    sb.from("grocery_items")
      .select("*")
      .eq("household_id", household.id)
      .then(({ data }) => setItems((data ?? []).map(normGroceryItem)));
  }, [sb, household]);

  const rows = useMemo(() => byKind(txs, ym, "grocery"), [txs, ym]);
  const total = sum(rows.map((t) => t.amount));
  const sharedTotal = sum(rows.filter((t) => t.scope === "shared").map((t) => t.amount));

  const byPerson = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of rows) if (t.paid_by) out[t.paid_by] = (out[t.paid_by] ?? 0) + t.amount;
    return out;
  }, [rows]);

  // items belonging to this month, via their linked shop or when they were added
  const monthItems = useMemo(() => {
    const txDates = new Map(txs.map((t) => [t.id, t.occurred_on.slice(0, 7)]));
    return items.filter((i) => {
      const m = (i.transaction_id && txDates.get(i.transaction_id)) || i.created_at.slice(0, 7);
      return m === ym;
    });
  }, [items, txs, ym]);

  const estVsActual = useMemo(() => {
    const purchased = monthItems.filter((i) => i.purchased);
    return {
      est: sum(purchased.map((i) => i.est_price ?? 0)),
      actual: sum(purchased.map((i) => i.actual_price ?? 0)),
    };
  }, [monthItems]);

  const byCategory = useMemo(() => {
    const out = new Map<string, number>();
    for (const i of monthItems) {
      if (!i.purchased || !i.actual_price) continue;
      out.set(i.category, (out.get(i.category) ?? 0) + i.actual_price);
    }
    return [...out.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthItems]);

  return (
    <div>
      <PageHeader
        title="Groceries"
        description="Grocery spending, with estimates and categories fed by the grocery list."
        actions={
          <>
            <MonthNav value={ym} onChange={setYm} />
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>Record shop</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Spent this month"
          value={fmtR(total)}
          sub={household?.grocery_budget ? `budget ${fmtR(household.grocery_budget)}` : `shared ${fmtR(sharedTotal)}`}
          tone={household?.grocery_budget && total > household.grocery_budget ? "warn" : undefined}
        />
        <Stat
          label="Estimated vs actual"
          value={estVsActual.actual > 0 || estVsActual.est > 0 ? `${fmtR(estVsActual.est)} / ${fmtR(estVsActual.actual)}` : "—"}
          sub="from purchased list items"
        />
        {memberIds.slice(0, 2).map((id) => (
          <Stat key={id} label={`${nameOf(id)} paid`} value={fmtR(byPerson[id] ?? 0)} />
        ))}
      </div>

      {byCategory.length > 0 && (
        <Card className="mb-6">
          <SectionTitle>Spending by category</SectionTitle>
          <BarList rows={byCategory} />
        </Card>
      )}

      <p className="mb-4 text-sm text-muted">
        Planning a shop? Build it on the{" "}
        <Link href="/grocery-list" className="text-accent underline-offset-2 hover:underline">
          grocery list
        </Link>{" "}
        — purchased items can be turned into a spending entry there.
      </p>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <TxTable
          rows={rows}
          onEdit={(tx) => { setEditing(tx); setModalOpen(true); }}
          onDeleted={remove}
          emptyText="No grocery shops recorded this month yet."
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
