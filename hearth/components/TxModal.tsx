"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import type { Tx, TxKind, TxScope, TxType } from "@/lib/types";
import { saveTransaction, uploadFile, type TxInput } from "@/lib/data";
import { round2, todayISO, currentMonth, monthLabel } from "@/lib/format";
import { TRANSPORT_TYPES, BUSINESS_EXPENSE_TYPES } from "@/lib/constants";
import { Button, ErrorNote, Field, Input, Modal, Segmented, Select, Textarea } from "./ui";

export type TxPreset = {
  kind: TxKind;
  type: TxType;
  title: string;
  scope?: TxScope;
  lockScope?: boolean;
  defaultCategory?: string; // category name
  defaultDescription?: string;
  defaultAmount?: number;
};

export default function TxModal({
  open,
  onClose,
  preset,
  existing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  preset: TxPreset;
  existing?: Tx | null;
  onSaved: (tx: Tx) => void;
}) {
  const { sb, user, household, members, memberIds, categories, nameOf } = useApp();
  const kind = existing?.kind ?? preset.kind;
  const type = existing?.type ?? preset.type;

  const defaultCategoryId = useMemo(() => {
    const wanted =
      preset.defaultCategory ??
      ({ rent: "Rent", grocery: "Groceries", electricity: "Electricity", transport: "Transport" } as Record<string, string>)[kind];
    return categories.find((c) => c.name === wanted)?.id ?? null;
  }, [categories, preset.defaultCategory, kind]);

  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | "">("");
  const [paidBy, setPaidBy] = useState<string>("");
  const [scope, setScope] = useState<TxScope>(preset.scope ?? "shared");
  const [split, setSplit] = useState<"equal" | "none" | "custom">("equal");
  const [customShares, setCustomShares] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // kind-specific
  const [rentMonth, setRentMonth] = useState(currentMonth());
  const [store, setStore] = useState("");
  const [kwh, setKwh] = useState("");
  const [transportType, setTransportType] = useState<string>(TRANSPORT_TYPES[0]);
  const [purpose, setPurpose] = useState("");
  const [client, setClient] = useState("");
  const [service, setService] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">("paid");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setFile(null);
    if (existing) {
      setDate(existing.occurred_on);
      setDescription(existing.description);
      setAmount(String(existing.amount));
      setCategoryId(existing.category_id ?? "");
      setPaidBy(existing.paid_by ?? user?.id ?? "");
      setScope(existing.scope);
      setSplit(existing.split_type === "custom" ? "custom" : existing.split_type === "equal" ? "equal" : "none");
      setCustomShares(
        Object.fromEntries(existing.splits.map((s) => [s.user_id, String(s.share_amount)])),
      );
      setNotes(existing.notes ?? "");
      setRentMonth(existing.meta.month ?? currentMonth());
      setStore(existing.meta.store ?? "");
      setKwh(existing.meta.kwh != null ? String(existing.meta.kwh) : "");
      setTransportType(existing.meta.transport_type ?? TRANSPORT_TYPES[0]);
      setPurpose(existing.meta.purpose ?? "");
      setClient(existing.meta.client ?? "");
      setService(existing.meta.service ?? "");
      setPaymentStatus(existing.meta.payment_status ?? "paid");
    } else {
      setDate(todayISO());
      setDescription(preset.defaultDescription ?? "");
      setAmount(preset.defaultAmount != null ? String(preset.defaultAmount) : "");
      setCategoryId(defaultCategoryId ?? "");
      setPaidBy(user?.id ?? "");
      setScope(preset.scope ?? "shared");
      setSplit(kind === "rent" ? "none" : "equal");
      setCustomShares({});
      setNotes("");
      setRentMonth(currentMonth());
      setStore("");
      setKwh("");
      setTransportType(TRANSPORT_TYPES[0]);
      setPurpose("");
      setClient("");
      setService("");
      setPaymentStatus("paid");
    }
  }, [open, existing, preset, defaultCategoryId, user, kind]);

  if (!household || !user) return null;

  const isSharedExpense = type === "expense" && scope === "shared";
  const amt = round2(Number(amount) || 0);

  const customTotal = round2(
    memberIds.reduce((a, id) => a + (Number(customShares[id]) || 0), 0),
  );

  async function submit() {
    if (!household || !user) return;
    setError("");
    if (!description.trim() && kind !== "rent") return setError("Add a short description.");
    if (!(amt > 0)) return setError("Amount must be more than zero.");
    if (isSharedExpense && split === "custom" && customTotal !== amt) {
      return setError(`Custom shares must add up to the amount (currently R${customTotal.toFixed(2)} of R${amt.toFixed(2)}).`);
    }
    setSaving(true);

    let receiptPath: string | null | undefined = undefined;
    if (file) {
      const up = await uploadFile(sb, household.id, kind, file);
      if (up.error) {
        setSaving(false);
        return setError(`Upload failed: ${up.error}`);
      }
      receiptPath = up.path;
    }

    const meta: TxInput["meta"] = {};
    if (kind === "rent") { meta.month = rentMonth; meta.payment_status = paymentStatus; }
    if (kind === "grocery" && store.trim()) meta.store = store.trim();
    if (kind === "electricity" && kwh) meta.kwh = round2(Number(kwh) || 0);
    if (kind === "transport") { meta.transport_type = transportType; if (purpose.trim()) meta.purpose = purpose.trim(); }
    if (kind === "business_income") {
      if (client.trim()) meta.client = client.trim();
      if (service.trim()) meta.service = service.trim();
      meta.payment_status = paymentStatus;
    }
    if (kind === "business_expense" && purpose) meta.purpose = purpose;

    const input: TxInput = {
      occurred_on: date,
      description: description.trim() || (kind === "rent" ? `Rent — ${monthLabel(rentMonth)}` : ""),
      category_id: categoryId || null,
      amount: amt,
      type,
      scope,
      kind,
      paid_by: paidBy || null,
      split_type: !isSharedExpense ? "none" : split === "custom" ? "custom" : split === "equal" ? "equal" : "none",
      customSplits:
        isSharedExpense && split === "custom"
          ? memberIds.map((id) => ({ user_id: id, share_amount: round2(Number(customShares[id]) || 0) }))
          : undefined,
      receipt_path: receiptPath,
      notes: notes.trim() || null,
      meta,
    };

    const res = await saveTransaction(sb, {
      householdId: household.id,
      userId: user.id,
      memberIds,
      nameOf,
      input,
      existing,
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    if (res.tx) onSaved(res.tx);
    onClose();
  }

  return (
    <Modal title={existing ? `Edit ${preset.title.toLowerCase()}` : preset.title} open={open} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Amount (R)">
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </div>

        {kind === "rent" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Rent month">
              <Input type="month" value={rentMonth} onChange={(e) => setRentMonth(e.target.value)} />
            </Field>
            <Field label="Payment status">
              <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as "paid" | "pending")}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </Select>
            </Field>
          </div>
        ) : (
          <Field label="Description">
            <Input
              placeholder={
                kind === "grocery" ? "e.g. Weekly groceries" :
                kind === "electricity" ? "e.g. Prepaid electricity" :
                kind === "business_income" ? "e.g. Meal prep order" : "What was this for?"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        )}

        {kind === "grocery" && (
          <Field label="Store">
            <Input placeholder="e.g. Checkers" value={store} onChange={(e) => setStore(e.target.value)} />
          </Field>
        )}
        {kind === "electricity" && (
          <Field label="Units received (kWh)">
            <Input type="number" min="0" step="0.1" inputMode="decimal" placeholder="e.g. 40.5" value={kwh} onChange={(e) => setKwh(e.target.value)} />
          </Field>
        )}
        {kind === "transport" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={transportType} onChange={(e) => setTransportType(e.target.value)}>
                {TRANSPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Purpose">
              <Input placeholder="e.g. Trip to the shops" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </Field>
          </div>
        )}
        {kind === "business_income" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Client">
              <Input value={client} onChange={(e) => setClient(e.target.value)} />
            </Field>
            <Field label="Service">
              <Input placeholder="e.g. Meal prep, 5 meals" value={service} onChange={(e) => setService(e.target.value)} />
            </Field>
            <Field label="Payment status">
              <Select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as "paid" | "pending")}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </Select>
            </Field>
          </div>
        )}
        {kind === "business_expense" && (
          <Field label="Expense type">
            <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="">Choose…</option>
              {BUSINESS_EXPENSE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {kind === "general" && (
            <Field label="Category">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Uncategorised</option>
                {categories.filter((c) => c.kind === (type === "income" ? "income" : "expense")).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={type === "income" ? "Received by" : "Paid by"}>
            <Select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{nameOf(m.id)}</option>
              ))}
            </Select>
          </Field>
        </div>

        {type === "expense" && scope !== "business" && !preset.lockScope && (
          <Field label="Shared or personal">
            <Segmented
              options={[
                { value: "shared", label: "Shared" },
                { value: "personal", label: "Personal" },
              ]}
              value={scope === "personal" ? "personal" : "shared"}
              onChange={(v) => setScope(v as TxScope)}
            />
          </Field>
        )}

        {isSharedExpense && (
          <Field
            label="Split"
            hint={
              split === "equal"
                ? "Split equally — whoever paid is owed the other shares."
                : split === "none"
                  ? kind === "rent"
                    ? "Own share — this payment covers only the payer's rent."
                    : "Own share — counts toward household spending, creates no debt."
                  : "Set each person's share of the amount."
            }
          >
            <Segmented
              options={[
                { value: "equal", label: "50/50" },
                { value: "none", label: "Own share" },
                { value: "custom", label: "Custom" },
              ]}
              value={split}
              onChange={(v) => setSplit(v)}
            />
            {split === "custom" && (
              <div className="mt-3 space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-muted">{nameOf(m.id)}</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={customShares[m.id] ?? ""}
                      onChange={(e) => setCustomShares((s) => ({ ...s, [m.id]: e.target.value }))}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted">
                  Shares total R{customTotal.toFixed(2)} of R{amt.toFixed(2)}
                </p>
              </div>
            )}
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={kind === "electricity" ? "Screenshot (optional)" : "Receipt or proof (optional)"}>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
            {existing?.receipt_path && !file ? (
              <span className="mt-1 block text-xs text-faint">A file is already attached; choosing a new one replaces it.</span>
            ) : null}
          </Field>
          <Field label="Notes (optional)">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <ErrorNote>{error || null}</ErrorNote>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : existing ? "Save changes" : "Add"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
