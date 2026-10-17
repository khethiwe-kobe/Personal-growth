import { test } from "node:test";
import assert from "node:assert/strict";
import { mealNutrition, mealCost, scaleRecipe, priceForMargin, pricingScenarios, volumeDiscountPct, packagePrice, grossMargin, mealAllergens } from "../lib/costing";
import type { IngredientRow, MealRow } from "../lib/types";

const ing = (over: Partial<IngredientRow>): IngredientRow => ({ id: 1, name: "x", category: "poultry", base_unit: "g", kcal_per_100: 0, protein_per_100: 0, carbs_per_100: 0, fat_per_100: 0, fibre_per_100: 0, sodium_mg_per_100: 0, sugar_per_100: 0, allergens: "[]", default_cost_per_unit: 0, waste_pct: 5, seasonal_months: "[]", min_stock: 0, storage: "chilled", is_active: 1, ...over });
const meal: MealRow = { id: 1, name: "Bowl", category: "lunch", cuisine: "", description: "", servings: 4, serving_size_g: 400, prep_minutes: 10, cook_minutes: 20, cook_temp_c: null, shelf_life_days: 4, storage: "", reheating: "", food_safety_notes: "", dietary_tags: "[]", complexity: 2, bulk_friendly: 1, packaging_cost: 0, labour_minutes_per_serving: 6, selling_price: 95, tier: "standard", image_url: "", internal_rating: 4, nutrition_override: "{}", is_active: 1, created_at: "", updated_at: "" };
const chicken = ing({ id: 1, name: "Chicken breast", kcal_per_100: 165, protein_per_100: 31, fat_per_100: 3.6 });
const rice = ing({ id: 2, name: "Brown rice", category: "grains", kcal_per_100: 123, protein_per_100: 2.7, carbs_per_100: 26, fibre_per_100: 1.6 });
const soy = ing({ id: 3, name: "Soy sauce", category: "sauces", base_unit: "ml", allergens: JSON.stringify(["soy", "gluten"]) });
const lines = [
  { id: 1, meal_id: 1, ingredient_id: 1, quantity: 600, note: "", sort_order: 0, ingredient: chicken, price_per_unit: 0.089 },
  { id: 2, meal_id: 1, ingredient_id: 2, quantity: 320, note: "", sort_order: 1, ingredient: rice, price_per_unit: 0.03 },
  { id: 3, meal_id: 1, ingredient_id: 3, quantity: 40, note: "", sort_order: 2, ingredient: soy, price_per_unit: 0.04 },
];

test("nutrition per serving is derived from ingredients ÷ servings", () => {
  const n = mealNutrition(meal, lines);
  assert.equal(n.kcal, Math.round((600 * 1.65 + 320 * 1.23) / 4));
  assert.equal(n.protein, Math.round(((600 * 0.31 + 320 * 0.027) / 4) * 10) / 10);
  const ov = mealNutrition({ ...meal, nutrition_override: JSON.stringify({ kcal: 500 }) }, lines);
  assert.equal(ov.kcal, 500);
  assert.equal(ov.protein, n.protein);
});

test("allergens roll up from ingredients", () => {
  assert.deepEqual(mealAllergens(lines), ["gluten", "soy"]);
});

test("true cost includes ingredients, packaging, labour and overhead", () => {
  const c = mealCost(meal, lines, { default_packaging_cost: 6.5, labour_rate_per_hour: 45, overhead_per_meal: 8 });
  assert.equal(c.ingredients, Math.round(((600 * 0.089 + 320 * 0.03 + 40 * 0.04) / 4) * 100) / 100);
  assert.equal(c.packaging, 6.5);
  assert.equal(c.labour, 4.5);
  assert.equal(c.total, Math.round((c.ingredients + 6.5 + 4.5 + 8) * 100) / 100);
  const m = grossMargin(95, c.total);
  assert.equal(m.profit, Math.round((95 - c.total) * 100) / 100);
});

test("recipe scaling: 4 servings → 40 multiplies by 10", () => {
  const s = scaleRecipe(meal, lines, 40);
  assert.equal(s[0].quantity, 6000);
  assert.equal(s[1].quantity, 3200);
  assert.equal(scaleRecipe(meal, lines, 10, 1.25)[0].quantity, 1875);
});

test("pricing: margin → price rounded up to R5, scenarios ordered", () => {
  assert.equal(priceForMargin(45, 0.5), 90);
  assert.equal(priceForMargin(65, 0.55), 145);
  const sc = pricingScenarios(45, { conservative: 0.45, standard: 0.55, premium: 0.65 });
  assert.ok(sc[0].price < sc[1].price && sc[1].price < sc[2].price);
  assert.ok(sc.every((s) => s.price >= 45 / (1 - s.margin)));
});

test("volume discounts never exceed half the standard margin", () => {
  assert.equal(volumeDiscountPct(5, 0.55), 0);
  assert.equal(volumeDiscountPct(10, 0.55), 0.05);
  assert.equal(volumeDiscountPct(28, 0.55), 0.15);
  assert.equal(volumeDiscountPct(28, 0.2), 0.1);
  const p = packagePrice(14, 95, 0.55);
  assert.equal(p.discount_pct, 0.08);
  assert.equal(p.price, Math.ceil((14 * 95 * 0.92) / 5) * 5);
});
