import type { IngredientCategory } from "./types";

/**
 * Grocery aggregation: order items (meal × quantity × portion multiplier) →
 * recipe lines → ingredient requirements, with waste allowance and inventory
 * netting. Pure functions over plain inputs so it can serve meal plans, orders
 * or production batches alike.
 */

export type Demand = { meal_id: number; servings: number; portion_multiplier: number };
export type RecipeLineLite = { meal_id: number; ingredient_id: number; quantity: number; recipe_servings: number };
export type IngredientLite = {
  id: number; name: string; category: IngredientCategory; base_unit: string; waste_pct: number;
  stock: number; best_price: number | null; best_supplier: string | null; min_stock: number;
};

export type GroceryLine = {
  ingredient_id: number;
  name: string;
  category: IngredientCategory;
  unit: string;
  required: number;        // net recipe requirement
  with_waste: number;      // after waste allowance
  stock: number;
  to_purchase: number;     // max(0, with_waste - stock)
  est_cost: number | null;
  supplier: string | null;
  meals: string[];
};

export function aggregateRequirements(
  demand: Demand[],
  lines: RecipeLineLite[],
  ingredients: Map<number, IngredientLite>,
  mealNames: Map<number, string>,
  defaultWastePct = 5
): GroceryLine[] {
  const req = new Map<number, { qty: number; meals: Set<string> }>();
  for (const d of demand) {
    const mealLines = lines.filter((l) => l.meal_id === d.meal_id);
    for (const l of mealLines) {
      const perServing = l.quantity / Math.max(1, l.recipe_servings);
      const qty = perServing * d.servings * d.portion_multiplier;
      const cur = req.get(l.ingredient_id) ?? { qty: 0, meals: new Set<string>() };
      cur.qty += qty;
      cur.meals.add(mealNames.get(d.meal_id) ?? `Meal ${d.meal_id}`);
      req.set(l.ingredient_id, cur);
    }
  }
  const out: GroceryLine[] = [];
  for (const [ingredientId, r] of req) {
    const ing = ingredients.get(ingredientId);
    if (!ing) continue;
    const waste = (ing.waste_pct ?? defaultWastePct) / 100;
    const withWaste = r.qty * (1 + waste);
    const toPurchase = Math.max(0, withWaste - ing.stock);
    out.push({
      ingredient_id: ingredientId,
      name: ing.name,
      category: ing.category,
      unit: ing.base_unit,
      required: round(r.qty),
      with_waste: round(withWaste),
      stock: round(ing.stock),
      to_purchase: round(toPurchase),
      est_cost: ing.best_price != null ? Math.round(toPurchase * ing.best_price * 100) / 100 : null,
      supplier: ing.best_supplier,
      meals: [...r.meals].sort(),
    });
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function groupByCategory(lines: GroceryLine[]): { category: IngredientCategory; lines: GroceryLine[]; est_cost: number }[] {
  const map = new Map<IngredientCategory, GroceryLine[]>();
  for (const l of lines) map.set(l.category, [...(map.get(l.category) ?? []), l]);
  return [...map.entries()].map(([category, ls]) => ({ category, lines: ls, est_cost: ls.reduce((s, l) => s + (l.est_cost ?? 0), 0) }));
}

/** Human quantity: 18000 g → "18 kg", 750 ml → "750 ml", 120 each → "120". */
export function formatQty(qty: number, unit: string): string {
  if (unit === "g") return qty >= 1000 ? `${trim(qty / 1000)} kg` : `${trim(qty)} g`;
  if (unit === "ml") return qty >= 1000 ? `${trim(qty / 1000)} L` : `${trim(qty)} ml`;
  return `${trim(qty)}`;
}
function trim(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
