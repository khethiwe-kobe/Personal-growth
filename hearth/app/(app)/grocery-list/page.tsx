"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import type { GroceryItem, Tx } from "@/lib/types";
import { normGroceryItem } from "@/lib/types";
import { logActivity } from "@/lib/data";
import { fmtR, round2 } from "@/lib/format";
import { sum } from "@/lib/money";
import { GROCERY_CATEGORIES } from "@/lib/constants";
import TxModal, { type TxPreset } from "@/components/TxModal";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Tag,
  cx,
} from "@/components/ui";

export default function GroceryListPage() {
  const { sb, household, user, nameOf } = useApp();
  const [items, setItems] = useState<GroceryItem[] | null>(null);
  const [error, setError] = useState("");
  const [itemModal, setItemModal] = useState<{ open: boolean; editing: GroceryItem | null }>({ open: false, editing: null });
  const [shopIds, setShopIds] = useState<string[]>([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [shopAmount, setShopAmount] = useState(0);
  const [showPurchased, setShowPurchased] = useState(true);

  useEffect(() => {
    if (!household) return;
    sb.from("grocery_items")
      .select("*")
      .eq("household_id", household.id)
      .order("purchased")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        setItems((data ?? []).map(normGroceryItem));
      });
  }, [sb, household]);

  const open = useMemo(() => (items ?? []).filter((i) => !i.purchased), [items]);
  const purchased = useMemo(() => (items ?? []).filter((i) => i.purchased), [items]);
  const unlinkedPurchased = purchased.filter((i) => !i.transaction_id);

  const estTotal = sum(open.map((i) => i.est_price ?? 0));

  async function togglePurchased(item: GroceryItem) {
    if (!household || !user) return;
    const next = !item.purchased;
    const patch = {
      purchased: next,
      purchased_by: next ? user.id : null,
      actual_price: next ? (item.actual_price ?? item.est_price) : item.actual_price,
    };
    const { error } = await sb.from("grocery_items").update(patch).eq("id", item.id);
    if (error) return setError(error.message);
    setItems((list) => (list ?? []).map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    await logActivity(sb, household.id, user.id, next ? "purchase" : "unpurchase", "grocery_item", item.id,
      `${next ? "marked" : "unmarked"} grocery item "${item.name}" as purchased`);
  }

  async function removeItem(item: GroceryItem) {
    if (!household || !user) return;
    const { error } = await sb.from("grocery_items").delete().eq("id", item.id);
    if (error) return setError(error.message);
    setItems((list) => (list ?? []).filter((i) => i.id !== item.id));
    await logActivity(sb, household.id, user.id, "delete", "grocery_item", item.id, `removed grocery item "${item.name}"`);
  }

  function startShop() {
    const ids = unlinkedPurchased.map((i) => i.id);
    const amount = round2(sum(unlinkedPurchased.map((i) => i.actual_price ?? i.est_price ?? 0)));
    setShopIds(ids);
    setShopAmount(amount);
    setShopOpen(true);
  }

  async function onShopSaved(tx: Tx) {
    if (!household || !user) return;
    await sb.from("grocery_items").update({ transaction_id: tx.id }).in("id", shopIds);
    setItems((list) =>
      (list ?? []).map((i) => (shopIds.includes(i.id) ? { ...i, transaction_id: tx.id } : i)),
    );
  }

  const shopPreset: TxPreset = {
    kind: "grocery",
    type: "expense",
    title: "Record this shop",
    scope: "shared",
    defaultDescription: `Groceries (${shopIds.length} items)`,
    defaultAmount: shopAmount,
  };

  return (
    <div>
      <PageHeader
        title="Grocery list"
        description="What the household needs, what it should cost, and what it actually cost."
        actions={
          <>
            {unlinkedPurchased.length > 0 && (
              <Button variant="ghost" onClick={startShop}>
                Record shop from {unlinkedPurchased.length} purchased item{unlinkedPurchased.length > 1 ? "s" : ""}
              </Button>
            )}
            <Button onClick={() => setItemModal({ open: true, editing: null })}>Add item</Button>
          </>
        }
      />

      <ErrorNote>{error || null}</ErrorNote>

      <div className="mb-6 mt-2 text-sm text-muted">
        {open.length} item{open.length === 1 ? "" : "s"} to buy — estimated{" "}
        <span className="font-medium text-ink tabular-nums">{fmtR(estTotal)}</span>
      </div>

      {items === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-6">
          <ItemList
            items={open}
            empty="Nothing on the list — add what you need."
            onToggle={togglePurchased}
            onEdit={(i) => setItemModal({ open: true, editing: i })}
            onDelete={removeItem}
            nameOf={nameOf}
          />

          {purchased.length > 0 && (
            <div>
              <button
                type="button"
                className="mb-3 text-sm font-medium text-muted hover:text-ink"
                onClick={() => setShowPurchased((v) => !v)}
              >
                {showPurchased ? "Hide" : "Show"} purchased ({purchased.length})
              </button>
              {showPurchased && (
                <ItemList
                  items={purchased}
                  empty=""
                  onToggle={togglePurchased}
                  onEdit={(i) => setItemModal({ open: true, editing: i })}
                  onDelete={removeItem}
                  nameOf={nameOf}
                />
              )}
            </div>
          )}
        </div>
      )}

      <ItemModal
        open={itemModal.open}
        editing={itemModal.editing}
        onClose={() => setItemModal({ open: false, editing: null })}
        onSaved={(item, isNew) =>
          setItems((list) =>
            isNew ? [item, ...(list ?? [])] : (list ?? []).map((i) => (i.id === item.id ? item : i)),
          )
        }
      />

      <TxModal
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        preset={shopPreset}
        onSaved={onShopSaved}
      />
    </div>
  );
}

function ItemList({
  items,
  empty,
  onToggle,
  onEdit,
  onDelete,
  nameOf,
}: {
  items: GroceryItem[];
  empty: string;
  onToggle: (i: GroceryItem) => void;
  onEdit: (i: GroceryItem) => void;
  onDelete: (i: GroceryItem) => void;
  nameOf: (id: string | null | undefined) => string;
}) {
  if (!items.length) return empty ? <Empty>{empty}</Empty> : null;
  return (
    <Card className="divide-y divide-border p-0">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-3">
          <input
            type="checkbox"
            checked={item.purchased}
            onChange={() => onToggle(item)}
            className="h-4 w-4 accent-[var(--accent)]"
            aria-label={`Mark ${item.name} purchased`}
          />
          <div className="min-w-0 flex-1">
            <div className={cx("truncate text-sm font-medium", item.purchased && "text-muted line-through")}>
              {item.name}
              {item.quantity !== "1" ? <span className="ml-1 font-normal text-muted">× {item.quantity}</span> : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Tag>{item.category}</Tag>
              {item.est_price != null && <span>est {fmtR(item.est_price)}</span>}
              {item.actual_price != null && <span>actual {fmtR(item.actual_price)}</span>}
              {item.purchased && item.purchased_by && <span>by {nameOf(item.purchased_by)}</span>}
              {item.transaction_id && <Tag tone="good">In a shop</Tag>}
            </div>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>Edit</Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(item)}>Remove</Button>
          </div>
        </div>
      ))}
    </Card>
  );
}

function ItemModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: GroceryItem | null;
  onClose: () => void;
  onSaved: (item: GroceryItem, isNew: boolean) => void;
}) {
  const { sb, household, user } = useApp();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState<string>("Other");
  const [est, setEst] = useState("");
  const [actual, setActual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(editing?.name ?? "");
    setQuantity(editing?.quantity ?? "1");
    setCategory(editing?.category ?? "Other");
    setEst(editing?.est_price != null ? String(editing.est_price) : "");
    setActual(editing?.actual_price != null ? String(editing.actual_price) : "");
  }, [open, editing]);

  async function submit() {
    if (!household || !user) return;
    if (!name.trim()) return setError("Give the item a name.");
    setBusy(true);
    const row = {
      household_id: household.id,
      name: name.trim(),
      quantity: quantity.trim() || "1",
      category,
      est_price: est === "" ? null : round2(Number(est) || 0),
      actual_price: actual === "" ? null : round2(Number(actual) || 0),
    };
    if (editing) {
      const { error } = await sb.from("grocery_items").update(row).eq("id", editing.id);
      setBusy(false);
      if (error) return setError(error.message);
      onSaved({ ...editing, ...row }, false);
      await logActivity(sb, household.id, user.id, "edit", "grocery_item", editing.id, `edited grocery item "${row.name}"`);
    } else {
      const { data, error } = await sb
        .from("grocery_items")
        .insert({ ...row, created_by: user.id })
        .select("*")
        .single();
      setBusy(false);
      if (error) return setError(error.message);
      onSaved(normGroceryItem(data), true);
      await logActivity(sb, household.id, user.id, "add", "grocery_item", data.id, `added grocery item "${row.name}"`);
    }
    onClose();
  }

  return (
    <Modal title={editing ? "Edit item" : "Add item"} open={open} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Item">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken breasts" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity">
            <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 2kg" />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {GROCERY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Estimated price (R)">
            <Input type="number" min="0" step="0.01" value={est} onChange={(e) => setEst(e.target.value)} />
          </Field>
          <Field label="Actual price (R)">
            <Input type="number" min="0" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} />
          </Field>
        </div>
        <ErrorNote>{error || null}</ErrorNote>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
