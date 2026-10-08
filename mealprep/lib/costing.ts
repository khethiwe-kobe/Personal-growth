import type { IngredientRow, MealRow, Nutrition, RecipeIngredientRow } from "./types";
import { ZERO_NUTRITION, parseJson } from "./types";

/**
 * Derived meal facts: nutrition per serving (from ingredient data), true cost
 * per serving (ingredients + packaging + labour + overhead), recipe scaling and
 * pricing scenarios. Pure functions — the repo layer supplies rows.
 */

export type RecipeLine = RecipeIngredientRow & { ingredient: IngredientRow; price_per_unit: number };

export function nutritionForQuantity(ing: IngredientRow, qty: number): Nutrition {
  // "each" ingredients store nutrition per 100 units for consistency, except
  // eggs-style items where seed data expresses per 100 g and quantity is grams.
  const f = qty / 100;
  return {
    kcal: ing.kcal_per_100 * f,
    protein: ing.protein_per_100 * f,
    carbs: ing.carbs_per_100 * f,
    fat: ing.fat_per_100 * f,
    fibre: ing.fibre_per_100 * f,
    sodium_mg: ing.sodium_mg_per_100 * f,
    sugar: ing.sugar_per_100 * f,
  };
}

export function addNutrition(a: Nutrition, b: Nutrition, scale = 1): Nutrition {
  return {
    kcal: a.kcal + b.kcal * scale,
    protein: a.protein + b.protein * scale,
    carbs: a.carbs + b.carbs * scale,
    fat: a.fat + b.fat * scale,
    fibre: a.fibre + b.fibre * scale,
    sodium_mg: a.sodium_mg + b.sodium_mg * scale,
    sugar: a.sugar + b.sugar * scale,
  };
}

export function roundNutrition(n: Nutrition): Nutrition {
  const r = (x: number) => Math.round(x * 10) / 10;
  return { kcal: Math.round(n.kcal), protein: r(n.protein), carbs: r(n.carbs), fat: r(n.fat), fibre: r(n.fibre), sodium_mg: Math.round(n.sodium_mg), sugar: r(n.sugar) };
}

/** Per-serving nutrition from the recipe (manual overrides win per field). */
export function mealNutrition(meal: MealRow, lines: RecipeLine[]): Nutrition {
  let total = { ...ZERO_NUTRITION };
  for (const l of lines) total = addNutrition(total, nutritionForQuantity(l.ingredient, l.quantity));
  const servings = Math.max(1, meal.servings);
  const per: Nutrition = {
    kcal: total.kcal / servings, protein: total.protein / servings, carbs: total.carbs / servings,
    fat: total.fat / servings, fibre: total.fibre / servings, sodium_mg: total.sodium_mg / servings, sugar: total.sugar / servings,
  };
  const ov = parseJson<Partial<Nutrition>>(meal.nutrition_override, {});
  return roundNutrition({ ...per, ...stripUndefined(ov) });
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) if (v != null && v !== "") (out as Record<string, unknown>)[k] = Number(v);
  return out;
}

export function mealAllergens(lines: RecipeLine[]): string[] {
  const set = new Set<string>();
  for (const l of lines) for (const a of parseJson<string[]>(l.ingredient.allergens, [])) set.add(a);
  return [...set].sort();
}

export type CostSettings = {
  default_packaging_cost: number;
  labour_rate_per_hour: number;
  overhead_per_meal: number;
};

export type CostBreakdown = {
  ingredients: number;
  packaging: number;
  labour: number;
  overhead: number;
  total: number;
};

/** True cost per serving. Uses the best available supplier price per ingredient. */
export function mealCost(meal: MealRow, lines: RecipeLine[], s: CostSettings): CostBreakdown {
  const servings = Math.max(1, meal.servings);
  let ingredients = 0;
  for (const l of lines) ingredients += l.quantity * l.price_per_unit;
  ingredients = ingredients / servings;
  const packaging = meal.packaging_cost > 0 ? meal.packaging_cost : s.default_packaging_cost;
  const labour = (meal.labour_minutes_per_serving / 60) * s.labour_rate_per_hour;
  const overhead = s.overhead_per_meal;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { ingredients: r2(ingredients), packaging: r2(packaging), labour: r2(labour), overhead: r2(overhead), total: r2(ingredients + packaging + labour + overhead) };
}

export function grossMargin(price: number, cost: number): { profit: number; margin_pct: number } {
  const profit = Math.round((price - cost) * 100) / 100;
  const margin_pct = price > 0 ? Math.round((profit / price) * 1000) / 10 : 0;
  return { profit, margin_pct };
}

/** Scale recipe quantities from recipe yield to the servings required. */
export function scaleRecipe(meal: Pick<MealRow, "servings">, lines: { ingredient_id: number; quantity: number }[], servingsRequired: number, portionMultiplier = 1) {
  const factor = (servingsRequired * portionMultiplier) / Math.max(1, meal.servings);
  return lines.map((l) => ({ ingredient_id: l.ingredient_id, quantity: Math.round(l.quantity * factor * 100) / 100, factor }));
}

// ------------------------------------------------------------- pricing
export type MarginScenario = { name: "Conservative" | "Standard" | "Premium"; margin: number; price: number; profit: number };

/** Price that achieves a gross margin (margin = profit / price). */
export function priceForMargin(cost: number, margin: number): number {
  if (margin >= 1) return cost;
  return roundToPricePoint(cost / (1 - margin));
}

/** Round up to a 5-rand price point (R87.40 → R90) to keep a tidy menu. */
export function roundToPricePoint(price: number): number {
  return Math.ceil(price / 5) * 5;
}

export function pricingScenarios(cost: number, margins: { conservative: number; standard: number; premium: number }): MarginScenario[] {
  return (["Conservative", "Standard", "Premium"] as const).map((name) => {
    const margin = margins[name.toLowerCase() as keyof typeof margins];
    const price = priceForMargin(cost, margin);
    return { name, margin, price, profit: Math.round((price - cost) * 100) / 100 };
  });
}

/** Volume discount tiers that protect margin: discount never exceeds half of the standard gross margin. */
export function volumeDiscountPct(mealsPerWeek: number, standardMargin: number): number {
  const cap = standardMargin / 2;
  let d = 0;
  if (mealsPerWeek >= 28) d = 0.15;
  else if (mealsPerWeek >= 21) d = 0.12;
  else if (mealsPerWeek >= 14) d = 0.08;
  else if (mealsPerWeek >= 10) d = 0.05;
  return Math.min(d, cap);
}

export function packagePrice(mealsPerWeek: number, avgMealPrice: number, standardMargin: number): { discount_pct: number; price: number; per_meal: number } {
  const discount_pct = volumeDiscountPct(mealsPerWeek, standardMargin);
  const price = roundToPricePoint(mealsPerWeek * avgMealPrice * (1 - discount_pct));
  return { discount_pct, price, per_meal: Math.round((price / mealsPerWeek) * 100) / 100 };
}

/** Deterministic (locale-independent) currency formatting so server and client HTML match. */
function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
export function formatZar(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(2).split(".");
  return (neg ? "−R" : "R") + group(i) + "." + f;
}
export function formatZar0(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const neg = n < 0;
  return (neg ? "−R" : "R") + group(String(Math.round(Math.abs(n))));
}

/** Break-even: contribution per meal → meals, clients and revenue needed to cover fixed costs. */
export function breakEven(fixedMonthly: number, avgPrice: number, avgVariable: number, mealsPerClientPerMonth = 20) {
  const contribution = avgPrice - avgVariable;
  const meals = contribution > 0 ? Math.ceil(fixedMonthly / contribution) : Infinity;
  return {
    contribution, contribution_margin_pct: avgPrice > 0 ? (contribution / avgPrice) * 100 : 0,
    meals, clients: Number.isFinite(meals) ? Math.ceil(meals / mealsPerClientPerMonth) : Infinity,
    revenue: Number.isFinite(meals) ? meals * avgPrice : Infinity,
  };
}
