"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import type { Meal } from "@/lib/types";
import { normMeal } from "@/lib/types";
import { logActivity } from "@/lib/data";
import { addIngredientsToList, useMeals } from "@/lib/meals";
import { MEAL_CATEGORIES } from "@/lib/constants";
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
  Textarea,
} from "@/components/ui";

export default function MealsPage() {
  const { sb, household, user } = useApp();
  const { meals, loading, setMeals } = useMeals();
  const [modal, setModal] = useState<{ open: boolean; editing: Meal | null }>({ open: false, editing: null });
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");

  const shown = useMemo(
    () => (filter ? meals.filter((m) => m.category === filter) : meals),
    [meals, filter],
  );

  async function removeMeal(meal: Meal) {
    if (!household || !user) return;
    if (!window.confirm(`Delete meal "${meal.name}"? It will also come off the planner.`)) return;
    const { error } = await sb.from("meals").delete().eq("id", meal.id);
    if (!error) {
      setMeals((list) => (list ?? []).filter((m) => m.id !== meal.id));
      await logActivity(sb, household.id, user.id, "delete", "meal", meal.id, `deleted meal "${meal.name}"`);
    }
  }

  async function toList(meal: Meal) {
    if (!household || !user) return;
    const n = await addIngredientsToList(sb, household.id, user.id, meal.ingredients);
    setNotice(n ? `Added ${n} ingredient${n > 1 ? "s" : ""} to the grocery list.` : "Everything is already on the list.");
    setTimeout(() => setNotice(""), 4000);
  }

  return (
    <div>
      <PageHeader
        title="Meal ideas"
        description="Meals you both like, with their ingredients — the planner builds on these."
        actions={
          <>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-auto">
              <option value="">All categories</option>
              {MEAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Button onClick={() => setModal({ open: true, editing: null })}>Add meal</Button>
          </>
        }
      />

      {notice ? <p className="mb-4 text-sm text-good">{notice}</p> : null}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !shown.length ? (
        <Empty>No meals saved yet — add your first idea.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((meal) => (
            <Card key={meal.id} className="flex flex-col">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="font-semibold">{meal.name}</h3>
                <Tag>{meal.category}</Tag>
              </div>
              {meal.ingredients.length > 0 && (
                <p className="text-sm leading-relaxed text-muted">
                  {meal.ingredients.join(", ")}
                </p>
              )}
              {meal.notes ? <p className="mt-2 text-sm text-faint">{meal.notes}</p> : null}
              <div className="mt-auto flex gap-1 pt-4">
                {meal.ingredients.length > 0 && (
                  <Button size="sm" variant="subtle" onClick={() => toList(meal)}>
                    Add to grocery list
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setModal({ open: true, editing: meal })}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => removeMeal(meal)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <MealModal
        open={modal.open}
        editing={modal.editing}
        onClose={() => setModal({ open: false, editing: null })}
        onSaved={(meal, isNew) =>
          setMeals((list) =>
            isNew
              ? [...(list ?? []), meal].sort((a, b) => a.name.localeCompare(b.name))
              : (list ?? []).map((m) => (m.id === meal.id ? meal : m)),
          )
        }
      />
    </div>
  );
}

function MealModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Meal | null;
  onClose: () => void;
  onSaved: (meal: Meal, isNew: boolean) => void;
}) {
  const { sb, household, user } = useApp();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Dinner");
  const [ingredients, setIngredients] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "Dinner");
    setIngredients((editing?.ingredients ?? []).join("\n"));
    setNotes(editing?.notes ?? "");
  }, [open, editing]);

  async function submit() {
    if (!household || !user) return;
    if (!name.trim()) return setError("Give the meal a name.");
    setBusy(true);
    const row = {
      household_id: household.id,
      name: name.trim(),
      category,
      ingredients: ingredients.split("\n").map((s) => s.trim()).filter(Boolean),
      notes: notes.trim() || null,
    };
    if (editing) {
      const { error } = await sb.from("meals").update(row).eq("id", editing.id);
      setBusy(false);
      if (error) return setError(error.message);
      onSaved({ ...editing, ...row }, false);
      await logActivity(sb, household.id, user.id, "edit", "meal", editing.id, `edited meal "${row.name}"`);
    } else {
      const { data, error } = await sb.from("meals").insert({ ...row, created_by: user.id }).select("*").single();
      setBusy(false);
      if (error) return setError(error.message);
      onSaved(normMeal(data), true);
      await logActivity(sb, household.id, user.id, "add", "meal", data.id, `added meal "${row.name}"`);
    }
    onClose();
  }

  return (
    <Modal title={editing ? "Edit meal" : "Add meal"} open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Meal name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken curry" />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {MEAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Ingredients" hint="One per line — these can be pushed to the grocery list.">
          <Textarea rows={5} value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder={"Chicken breasts\nRice\nCurry paste"} />
        </Field>
        <Field label="Notes (optional)">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <ErrorNote>{error || null}</ErrorNote>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </Modal>
  );
}
