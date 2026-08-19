"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/useTransactions";
import {
  businessSummary,
  categoryBreakdown,
  computeFlags,
  contributionsByMember,
  monthsInData,
  rentCoverage,
  totalHouseholdExpenses,
  whoOwesWho,
} from "@/lib/money";
import { currentMonth, fmtR, monthLabelShort, round2 } from "@/lib/format";
import { saveTransaction } from "@/lib/data";
import { todayISO } from "@/lib/format";
import { BarList, Columns, PairBars } from "@/components/charts";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Modal,
  MonthNav,
  PageHeader,
  SectionTitle,
  Stat,
  Tag,
} from "@/components/ui";

export default function DashboardPage() {
  const { sb, household, user, memberIds, categories, nameOf } = useApp();
  const { txs, loading, upsert } = useTransactions();
  const [ym, setYm] = useState(currentMonth());
  const [pendingImports, setPendingImports] = useState(0);
  const [settleOpen, setSettleOpen] = useState(false);

  useEffect(() => {
    if (!household) return;
    sb.from("imported_transactions")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id)
      .eq("status", "pending")
      .then(({ count }) => setPendingImports(count ?? 0));
  }, [sb, household]);

  const summary = useMemo(() => {
    if (!household) return null;
    const total = totalHouseholdExpenses(txs, ym);
    const contributions = contributionsByMember(txs, ym);
    const owes = whoOwesWho(txs);
    const biz = businessSummary(txs, ym);
    const breakdown = categoryBreakdown(txs, ym, categories);
    const coverage = rentCoverage(txs, ym);
    const months = monthsInData(txs, ym).slice(-6);
    const trend = months.map((m) => ({
      label: monthLabelShort(m),
      value: totalHouseholdExpenses(txs, m),
    }));
    const prev = months[months.indexOf(ym) - 1];
    const prevTotal = prev ? totalHouseholdExpenses(txs, prev) : null;
    return { total, contributions, owes, biz, breakdown, coverage, trend, prevTotal };
  }, [txs, ym, categories, household]);

  if (!household || !summary) return null;

  const flags = computeFlags({
    txs,
    ym,
    household,
    memberIds,
    nameOf,
    pendingImports,
  });

  const remaining =
    household.monthly_budget != null
      ? round2(household.monthly_budget - summary.total)
      : null;

  const twoNames: [string, string] = [
    nameOf(memberIds[0]) ?? "Person 1",
    nameOf(memberIds[1]) ?? "Person 2",
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="How the household is doing this month."
        actions={<MonthNav value={ym} onChange={setYm} />}
      />

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-8">
          {flags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {flags.map((f, i) => (
                <Tag key={i} tone={f.tone === "warn" ? "warn" : "neutral"}>
                  {f.text}
                </Tag>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Household expenses"
              value={fmtR(summary.total)}
              sub={
                summary.prevTotal != null && summary.prevTotal > 0
                  ? `${summary.total >= summary.prevTotal ? "up" : "down"} from ${fmtR(summary.prevTotal)} last month`
                  : "this month"
              }
            />
            {memberIds.slice(0, 2).map((id) => (
              <Stat
                key={id}
                label={`${nameOf(id)} paid`}
                value={fmtR(summary.contributions[id] ?? 0)}
                sub="toward shared expenses"
              />
            ))}
            <Stat
              label="Business to household"
              value={fmtR(summary.biz.contributedThisMonth)}
              sub={`business income this month ${fmtR(summary.biz.incomeThisMonth)}`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle>Who owes who</SectionTitle>
              {summary.owes ? (
                <div>
                  <p className="text-lg font-semibold">
                    {nameOf(summary.owes.owedBy)} {summary.owes.owedBy === user?.id ? "owe" : "owes"}{" "}
                    {nameOf(summary.owes.owedTo).toLowerCase() === "you" ? "you" : nameOf(summary.owes.owedTo)}{" "}
                    <span className="tabular-nums">{fmtR(summary.owes.amount)}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Across all shared expenses and settlements, all time. Every amount is
                    traceable in{" "}
                    <Link className="text-accent underline-offset-2 hover:underline" href="/transactions">
                      transactions
                    </Link>
                    .
                  </p>
                  <div className="mt-4">
                    <Button size="sm" variant="ghost" onClick={() => setSettleOpen(true)}>
                      Record a settlement
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  You are square — nobody owes anybody at the moment.
                </p>
              )}
            </Card>

            <Card>
              <SectionTitle>Rent this month</SectionTitle>
              <div className="space-y-3">
                {memberIds.map((id) => {
                  const covered = summary.coverage[id] ?? 0;
                  const ok = covered >= household.rent_per_person - 0.01;
                  return (
                    <div key={id} className="flex items-center justify-between">
                      <span className="text-sm">{nameOf(id)}</span>
                      <span className="flex items-center gap-2 text-sm tabular-nums">
                        {fmtR(covered)} of {fmtR(household.rent_per_person)}
                        <Tag tone={ok ? "good" : "warn"}>{ok ? "Covered" : "Outstanding"}</Tag>
                      </span>
                    </div>
                  );
                })}
                <Link
                  href="/rent"
                  className="inline-block text-sm text-accent underline-offset-2 hover:underline"
                >
                  Go to rent
                </Link>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle>Spending by category</SectionTitle>
              {summary.breakdown.length ? (
                <BarList
                  rows={summary.breakdown.map((b) => ({ label: b.name, value: b.total }))}
                />
              ) : (
                <p className="text-sm text-muted">No shared expenses recorded this month yet.</p>
              )}
            </Card>
            <Card>
              <SectionTitle>Monthly spending</SectionTitle>
              <Columns points={summary.trend} />
              {remaining != null && (
                <p className="mt-4 text-sm text-muted">
                  Remaining budget this month:{" "}
                  <span className={remaining >= 0 ? "font-medium text-good" : "font-medium text-bad"}>
                    {fmtR(remaining)}
                  </span>{" "}
                  of {fmtR(household.monthly_budget as number)}
                </p>
              )}
            </Card>
          </div>

          {memberIds.length >= 2 && (
            <Card>
              <SectionTitle>Contributions</SectionTitle>
              <PairBars
                names={twoNames}
                rows={[
                  {
                    label: "Paid toward shared expenses this month",
                    a: summary.contributions[memberIds[0]] ?? 0,
                    b: summary.contributions[memberIds[1]] ?? 0,
                  },
                ]}
              />
              {summary.biz.contributedThisMonth > 0 && (
                <p className="mt-3 text-sm text-muted">
                  Plus {fmtR(summary.biz.contributedThisMonth)} contributed by the shared business.
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      <SettleModal
        open={settleOpen}
        onClose={() => setSettleOpen(false)}
        owes={summary.owes}
        onSaved={upsert}
      />
    </div>
  );
}

function SettleModal({
  open,
  onClose,
  owes,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  owes: { owedTo: string; owedBy: string; amount: number } | null;
  onSaved: (tx: import("@/lib/types").Tx) => void;
}) {
  const { sb, household, user, members, memberIds, nameOf } = useApp();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setFrom(owes?.owedBy ?? memberIds[0] ?? "");
    setTo(owes?.owedTo ?? memberIds[1] ?? "");
    setAmount(owes ? String(owes.amount) : "");
  }, [open, owes, memberIds]);

  async function submit() {
    if (!household || !user) return;
    const amt = round2(Number(amount) || 0);
    if (!(amt > 0)) return setError("Amount must be more than zero.");
    if (!from || !to || from === to) return setError("Choose two different people.");
    setBusy(true);
    const res = await saveTransaction(sb, {
      householdId: household.id,
      userId: user.id,
      memberIds,
      nameOf,
      input: {
        occurred_on: todayISO(),
        description: `Settlement — ${nameOf(from)} paid ${nameOf(to)}`,
        category_id: null,
        amount: amt,
        type: "expense",
        scope: "shared",
        kind: "settlement",
        paid_by: from,
        split_type: "custom",
        customSplits: [{ user_id: to, share_amount: amt }],
      },
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.tx) onSaved(res.tx);
    onClose();
  }

  return (
    <Modal title="Record a settlement" open={open} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Use this when one of you pays the other back. It clears the balance without
          counting as a household expense.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="From">
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{nameOf(m.id)}</option>
              ))}
            </select>
          </Field>
          <Field label="To">
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{nameOf(m.id)}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Amount (R)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <ErrorNote>{error || null}</ErrorNote>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Record"}</Button>
        </div>
      </div>
    </Modal>
  );
}
