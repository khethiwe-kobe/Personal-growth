"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/useTransactions";
import type { Tx } from "@/lib/types";
import { currentMonth, fmtR } from "@/lib/format";
import { sum } from "@/lib/money";
import TxModal, { type TxPreset } from "@/components/TxModal";
import TxTable from "@/components/TxTable";
import { Button, Input, MonthNav, PageHeader, Select } from "@/components/ui";

const ADD_PRESET: TxPreset = {
  kind: "general",
  type: "expense",
  title: "Add transaction",
};

export default function TransactionsPage() {
  const { members, categories, nameOf } = useApp();
  const { txs, loading, upsert, remove } = useTransactions();

  const [ym, setYm] = useState(currentMonth());
  const [allMonths, setAllMonths] = useState(false);
  const [person, setPerson] = useState("");
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState("");
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [preset, setPreset] = useState<TxPreset>(ADD_PRESET);

  const rows = useMemo(() => {
    let list = txs;
    if (!allMonths) list = list.filter((t) => t.occurred_on.slice(0, 7) === ym);
    if (person) list = list.filter((t) => t.paid_by === person);
    if (category) list = list.filter((t) => t.category_id === category);
    if (scope) list = list.filter((t) => t.scope === scope);
    if (type) list = list.filter((t) => t.type === type);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q) ||
          (t.meta.store ?? "").toLowerCase().includes(q),
      );
    }
    if (sortBy === "amount") {
      list = [...list].sort((a, b) => b.amount - a.amount);
    }
    return list;
  }, [txs, ym, allMonths, person, category, scope, type, query, sortBy]);

  const total = sum(rows.filter((t) => t.type === "expense" && t.kind !== "settlement").map((t) => t.amount));

  function editTx(tx: Tx) {
    setEditing(tx);
    setPreset({
      kind: tx.kind,
      type: tx.type,
      title: "Transaction",
      scope: tx.scope,
    });
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Every rand that moves through the household, in one place."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setPreset(ADD_PRESET);
              setModalOpen(true);
            }}
          >
            Add transaction
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MonthNav value={ym} onChange={(m) => { setYm(m); setAllMonths(false); }} />
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input
            type="checkbox"
            checked={allMonths}
            onChange={(e) => setAllMonths(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          All months
        </label>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <Input
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="col-span-2"
        />
        <Select value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="">Everyone</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{nameOf(m.id)}</option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="">Shared and personal</option>
          <option value="shared">Shared</option>
          <option value="personal">Personal</option>
          <option value="business">Business</option>
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Expense and income</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </Select>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span>
          {rows.length} transaction{rows.length === 1 ? "" : "s"} — expenses total{" "}
          <span className="font-medium text-ink tabular-nums">{fmtR(total)}</span>
        </span>
        <label className="flex items-center gap-2">
          Sort by
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "amount")}
            className="w-auto"
          >
            <option value="date">Date</option>
            <option value="amount">Amount</option>
          </Select>
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <TxTable
          rows={rows}
          showKind
          onEdit={editTx}
          onDeleted={remove}
          emptyText="No transactions match these filters."
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
