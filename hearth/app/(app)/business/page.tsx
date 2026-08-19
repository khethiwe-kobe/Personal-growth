"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/useTransactions";
import type { Tx } from "@/lib/types";
import { businessSummary } from "@/lib/money";
import { currentMonth, fmtR, round2, todayISO } from "@/lib/format";
import { saveTransaction } from "@/lib/data";
import TxModal, { type TxPreset } from "@/components/TxModal";
import TxTable from "@/components/TxTable";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Modal,
  PageHeader,
  SectionTitle,
  Segmented,
  Stat,
} from "@/components/ui";

const INCOME_PRESET: TxPreset = {
  kind: "business_income",
  type: "income",
  title: "Record business income",
  scope: "business",
  lockScope: true,
  defaultCategory: "Business income",
};

const EXPENSE_PRESET: TxPreset = {
  kind: "business_expense",
  type: "expense",
  title: "Record business expense",
  scope: "business",
  lockScope: true,
};

export default function BusinessPage() {
  const { txs, loading, upsert, remove } = useTransactions();
  const [tab, setTab] = useState<"income" | "expenses" | "contributions">("income");
  const [modalOpen, setModalOpen] = useState(false);
  const [preset, setPreset] = useState<TxPreset>(INCOME_PRESET);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);

  const ym = currentMonth();
  const s = useMemo(() => businessSummary(txs, ym), [txs, ym]);

  const rows = useMemo(() => {
    const kind =
      tab === "income" ? "business_income" : tab === "expenses" ? "business_expense" : "contribution";
    return txs.filter((t) => t.kind === kind);
  }, [txs, tab]);

  function openAdd(p: TxPreset) {
    setEditing(null);
    setPreset(p);
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Shared business"
        description="Meal-prep and service income, its costs, and what it contributes to the household."
        actions={
          <>
            <Button variant="ghost" onClick={() => openAdd(EXPENSE_PRESET)}>Add expense</Button>
            <Button onClick={() => openAdd(INCOME_PRESET)}>Add income</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total income" value={fmtR(s.income)} sub={`this month ${fmtR(s.incomeThisMonth)}`} />
        <Stat label="Total expenses" value={fmtR(s.expenses)} />
        <Stat label="Net profit" value={fmtR(s.net)} tone={s.net >= 0 ? "good" : "bad"} />
        <Stat label="Given to household" value={fmtR(s.contributed)} sub={`this month ${fmtR(s.contributedThisMonth)}`} />
        <Stat label="Available" value={fmtR(s.available)} tone={s.available > 0 ? "good" : undefined} />
      </div>

      {s.available > 0.01 && (
        <Card className="mb-6">
          <SectionTitle>Allocate to household</SectionTitle>
          <p className="mb-3 text-sm text-muted">
            The business has {fmtR(s.available)} available. Allocating it counts as
            household funding alongside what each of you pays in.
          </p>
          <Button size="sm" onClick={() => setAllocOpen(true)}>Allocate funds</Button>
        </Card>
      )}

      <div className="mb-4">
        <Segmented
          options={[
            { value: "income", label: "Income" },
            { value: "expenses", label: "Expenses" },
            { value: "contributions", label: "Household contributions" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <TxTable
          rows={rows}
          onEdit={(tx) => {
            setEditing(tx);
            setPreset(tx.kind === "business_income" ? INCOME_PRESET : EXPENSE_PRESET);
            setModalOpen(true);
          }}
          onDeleted={remove}
          emptyText={
            tab === "income"
              ? "No business income recorded yet."
              : tab === "expenses"
                ? "No business expenses recorded yet."
                : "Nothing allocated to the household yet."
          }
        />
      )}

      <TxModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        preset={preset}
        existing={editing}
        onSaved={upsert}
      />

      <AllocateModal
        open={allocOpen}
        onClose={() => setAllocOpen(false)}
        available={s.available}
        onSaved={upsert}
      />
    </div>
  );
}

function AllocateModal({
  open,
  onClose,
  available,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  available: number;
  onSaved: (tx: Tx) => void;
}) {
  const { sb, household, user, memberIds, nameOf } = useApp();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNotes("");
      setError("");
    }
  }, [open]);

  async function submit() {
    if (!household || !user) return;
    const amt = round2(Number(amount) || 0);
    if (!(amt > 0)) return setError("Amount must be more than zero.");
    if (amt > available + 0.01) return setError(`Only ${fmtR(available)} is available.`);
    setBusy(true);
    const res = await saveTransaction(sb, {
      householdId: household.id,
      userId: user.id,
      memberIds,
      nameOf,
      input: {
        occurred_on: todayISO(),
        description: "Business contribution to household",
        category_id: null,
        amount: amt,
        type: "income",
        scope: "shared",
        kind: "contribution",
        paid_by: null,
        split_type: "none",
        notes: notes.trim() || null,
      },
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.tx) onSaved(res.tx);
    onClose();
  }

  return (
    <Modal title="Allocate business funds to household" open={open} onClose={onClose}>
      <div className="space-y-4">
        <Field label={`Amount (R) — up to ${fmtR(available)}`}>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Toward August groceries" />
        </Field>
        <ErrorNote>{error || null}</ErrorNote>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Allocate"}</Button>
        </div>
      </div>
    </Modal>
  );
}
