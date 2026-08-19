"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useApp } from "./store";
import type { Meal } from "./types";
import { normMeal } from "./types";
import { logActivity } from "./data";

export function useMeals() {
  const { sb, household } = useApp();
  const [meals, setMeals] = useState<Meal[] | null>(null);
  useEffect(() => {
    if (!household) return;
    sb.from("meals")
      .select("*")
      .eq("household_id", household.id)
      .order("name")
      .then(({ data }) => setMeals((data ?? []).map(normMeal)));
  }, [sb, household]);
  return { meals: meals ?? [], loading: meals === null, setMeals };
}

/** Add ingredient names to the grocery list, skipping ones already on it (not yet purchased). */
export async function addIngredientsToList(
  sb: SupabaseClient,
  householdId: string,
  userId: string,
  ingredients: string[],
): Promise<number> {
  const { data: existing } = await sb
    .from("grocery_items")
    .select("name")
    .eq("household_id", householdId)
    .eq("purchased", false);
  const have = new Set(
    (existing ?? []).map((r: { name: string }) => r.name.trim().toLowerCase()),
  );
  const wanted = [...new Set(ingredients.map((i) => i.trim()).filter(Boolean))];
  const fresh = wanted.filter((i) => !have.has(i.toLowerCase()));
  if (!fresh.length) return 0;
  await sb.from("grocery_items").insert(
    fresh.map((name) => ({
      household_id: householdId,
      name,
      category: "Other",
      created_by: userId,
    })),
  );
  await logActivity(sb, householdId, userId, "add", "grocery_item", null,
    `added ${fresh.length} ingredient${fresh.length > 1 ? "s" : ""} to the grocery list`);
  return fresh.length;
}
