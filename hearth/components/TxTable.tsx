"use client";

import { useState } from "react";
import { useApp } from "@/lib/store";
import type { Tx } from "@/lib/types";
import { deleteTransaction, signedUrl, kindLabel } from "@/lib/data";
import { fmtDate, fmtR } from "@/lib/format";
import { Button, Empty, Tag } from "./ui";

export default function TxTable({
  rows,
  onEdit,
  onDeleted,
  showKind,
  emptyText = "Nothing here yet.",
}: {
  rows: Tx[];
  onEdit: (tx: Tx) => void;
  onDeleted: (id: string) => void;
  showKind?: boolean;
  emptyText?: string;
}) {
  const { sb, household, user, nameOf } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function openReceipt(tx: Tx) {
    if (!tx.receipt_path) return;
    const url = await signedUrl(sb, tx.receipt_path);
    if (url) window.open(url, "_blank", "noopener");
  }

  async function remove(tx: Tx) {
    if (!household || !user) return;
    if (!window.confirm(`Delete "${tx.description}" (${fmtR(tx.amount)})?`)) return;
    setBusyId(tx.id);
    const res = await deleteTransaction(sb, household.id, user.id, tx);
    setBusyId(null);
    if (!res.error) onDeleted(tx.id);
  }

  if (!rows.length) return <Empty>{emptyText}</Empty>;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-faint">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Description</th>
            {showKind ? <th className="px-4 py-3">Type</th> : null}
            <th className="px-4 py-3">Paid by</th>
            <th className="px-4 py-3">Split</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => (
            <tr key={tx.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(tx.occurred_on)}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-ink">{tx.description}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {tx.scope === "personal" && <Tag>Personal</Tag>}
                  {tx.scope === "business" && <Tag tone="accent">Business</Tag>}
                  {tx.kind === "settlement" && <Tag tone="good">Settlement</Tag>}
                  {tx.review_status === "needs_review" && <Tag tone="warn">Needs review</Tag>}
                  {tx.meta.payment_status === "pending" && <Tag tone="warn">Pending</Tag>}
                  {tx.meta.store ? <span className="text-xs text-muted">{tx.meta.store}</span> : null}
                  {tx.meta.kwh ? <span className="text-xs text-muted">{tx.meta.kwh} kWh</span> : null}
                  {tx.meta.transport_type ? <span className="text-xs text-muted">{tx.meta.transport_type}</span> : null}
                  {tx.receipt_path ? (
                    <button
                      type="button"
                      onClick={() => openReceipt(tx)}
                      className="text-xs text-accent underline-offset-2 hover:underline"
                    >
                      View file
                    </button>
                  ) : null}
                </div>
              </td>
              {showKind ? (
                <td className="whitespace-nowrap px-4 py-3 text-muted">{kindLabel(tx.kind)}</td>
              ) : null}
              <td className="whitespace-nowrap px-4 py-3">{nameOf(tx.paid_by)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-muted">
                {tx.scope !== "shared" || tx.type !== "expense"
                  ? "—"
                  : tx.kind === "settlement"
                    ? `to ${nameOf(tx.splits[0]?.user_id)}`
                    : tx.split_type === "equal"
                      ? "50/50"
                      : tx.split_type === "custom"
                        ? "Custom"
                        : "Own share"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                {tx.type === "income" ? "+" : ""}
                {fmtR(tx.amount)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <div className="inline-flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(tx)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => remove(tx)} disabled={busyId === tx.id}>
                    {busyId === tx.id ? "…" : "Delete"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
