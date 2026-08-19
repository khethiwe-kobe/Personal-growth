"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tx, TxKind, TxMeta, TxScope, TxType, SplitType } from "./types";
import { normTx } from "./types";
import { fmtR } from "./format";
import { computeEqualSplits } from "./money";

export async function logActivity(
  sb: SupabaseClient,
  householdId: string,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null,
  summary: string,
) {
  await sb.from("activity_log").insert({
    household_id: householdId,
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    summary,
  });
}

export type TxInput = {
  occurred_on: string;
  description: string;
  category_id: string | null;
  amount: number;
  type: TxType;
  scope: TxScope;
  kind: TxKind;
  paid_by: string | null;
  split_type: SplitType;
  customSplits?: Array<{ user_id: string; share_amount: number }>;
  receipt_path?: string | null;
  notes?: string | null;
  meta?: TxMeta;
  review_status?: "approved" | "needs_review";
  source?: "manual" | "import";
};

export function splitsFor(
  input: Pick<TxInput, "scope" | "kind" | "type" | "split_type" | "amount" | "paid_by" | "customSplits">,
  memberIds: string[],
): Array<{ user_id: string; share_amount: number }> {
  if (input.kind === "settlement") {
    // paid_by settles up; the full share goes to the recipient (stored in customSplits)
    return input.customSplits ?? [];
  }
  if (input.scope !== "shared" || input.type !== "expense") return [];
  if (input.split_type === "equal") {
    return computeEqualSplits(input.amount, memberIds, input.paid_by);
  }
  if (input.split_type === "custom") return input.customSplits ?? [];
  // 'none': the payer carries their own share — counts toward household
  // spending and their contribution, creates no debt.
  return input.paid_by
    ? [{ user_id: input.paid_by, share_amount: input.amount }]
    : [];
}

export async function saveTransaction(
  sb: SupabaseClient,
  opts: {
    householdId: string;
    userId: string;
    memberIds: string[];
    nameOf: (id: string | null) => string;
    input: TxInput;
    existing?: Tx | null;
  },
): Promise<{ tx?: Tx; error?: string }> {
  const { householdId, userId, memberIds, nameOf, input, existing } = opts;

  const row = {
    household_id: householdId,
    occurred_on: input.occurred_on,
    description: input.description.trim(),
    category_id: input.category_id,
    amount: input.amount,
    type: input.type,
    scope: input.scope,
    kind: input.kind,
    paid_by: input.paid_by,
    split_type: input.split_type,
    receipt_path: input.receipt_path ?? existing?.receipt_path ?? null,
    notes: input.notes ?? null,
    meta: input.meta ?? {},
    review_status: input.review_status ?? "approved",
    source: input.source ?? existing?.source ?? "manual",
  };

  let txId: string;
  if (existing) {
    const { error } = await sb.from("transactions").update(row).eq("id", existing.id);
    if (error) return { error: error.message };
    txId = existing.id;
  } else {
    const { data, error } = await sb
      .from("transactions")
      .insert({ ...row, created_by: userId })
      .select("id")
      .single();
    if (error) return { error: error.message };
    txId = data.id as string;
  }

  const splits = splitsFor(input, memberIds);
  await sb.from("transaction_splits").delete().eq("transaction_id", txId);
  if (splits.length) {
    const { error } = await sb
      .from("transaction_splits")
      .insert(splits.map((s) => ({ ...s, transaction_id: txId })));
    if (error) return { error: error.message };
  }

  const label = kindLabel(input.kind);
  if (existing) {
    const changes: string[] = [];
    if (existing.amount !== input.amount)
      changes.push(`amount ${fmtR(existing.amount)} to ${fmtR(input.amount)}`);
    if (existing.description !== row.description)
      changes.push(`description to "${row.description}"`);
    if (existing.paid_by !== input.paid_by)
      changes.push(`paid by to ${nameOf(input.paid_by)}`);
    if (existing.occurred_on !== input.occurred_on)
      changes.push(`date to ${input.occurred_on}`);
    const detail = changes.length ? ` — changed ${changes.join(", ")}` : "";
    await logActivity(sb, householdId, userId, "edit", "transaction", txId,
      `edited ${label} "${row.description}" (${fmtR(input.amount)})${detail}`);
  } else {
    await logActivity(sb, householdId, userId, "add", "transaction", txId,
      `added ${label} "${row.description}" — ${fmtR(input.amount)}, paid by ${nameOf(input.paid_by)}`);
  }

  const { data } = await sb
    .from("transactions")
    .select("*, splits:transaction_splits(*)")
    .eq("id", txId)
    .single();
  return { tx: data ? normTx(data) : undefined };
}

export async function deleteTransaction(
  sb: SupabaseClient,
  householdId: string,
  userId: string,
  tx: Tx,
): Promise<{ error?: string }> {
  const { error } = await sb.from("transactions").delete().eq("id", tx.id);
  if (error) return { error: error.message };
  await logActivity(sb, householdId, userId, "delete", "transaction", tx.id,
    `deleted ${kindLabel(tx.kind)} "${tx.description}" (${fmtR(tx.amount)})`);
  return {};
}

export function kindLabel(kind: TxKind): string {
  switch (kind) {
    case "rent": return "rent payment";
    case "grocery": return "grocery expense";
    case "electricity": return "electricity purchase";
    case "transport": return "transport expense";
    case "business_income": return "business income";
    case "business_expense": return "business expense";
    case "contribution": return "business contribution";
    case "settlement": return "settlement";
    default: return "transaction";
  }
}

export async function fetchAllTransactions(
  sb: SupabaseClient,
  householdId: string,
): Promise<Tx[]> {
  const { data, error } = await sb
    .from("transactions")
    .select("*, splits:transaction_splits(*)")
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normTx);
}

// ---------------------------------------------------------------------------
// Storage helpers — everything lives under <household_id>/... in the private
// `receipts` bucket; RLS on storage.objects gates by membership.
// ---------------------------------------------------------------------------

export async function uploadFile(
  sb: SupabaseClient,
  householdId: string,
  folder: string,
  file: File,
): Promise<{ path?: string; error?: string }> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${householdId}/${folder}/${Date.now()}-${safe}`;
  const { error } = await sb.storage.from("receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path };
}

export async function signedUrl(
  sb: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data } = await sb.storage.from("receipts").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
