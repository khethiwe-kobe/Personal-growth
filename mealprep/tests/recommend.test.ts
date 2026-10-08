import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreMeal, recommend, suggestSubstitutions, type MealProfile, type ClientContext } from "../lib/recommend";
import { generatePlan, auditPlan, slotsFor } from "../lib/planner";
import { aggregateRequirements, formatQty } from "../lib/grocery";

const meal = (over: Partial<MealProfile>): MealProfile => ({ id: 1, name: "Chicken bowl", category: "lunch", cuisine: "Asian", dietary_tags: ["high_protein"], allergens: [], ingredient_names: ["Chicken breast", "Brown rice", "Broccoli"], nutrition: { kcal: 450, protein: 45, carbs: 40, fat: 12, fibre: 6, sodium_mg: 500, sugar: 3 }, cost: 40, price: 95, complexity: 2, bulk_friendly: true, in_stock_ratio: 1, seasonal_ratio: 1, avg_rating: 4.5, times_ordered_by_client: 0, ...over });
const ctx: ClientContext = { slot_kcal: { breakfast: 450, lunch: 540, snack: 180, dinner: 630 }, protein_target: 130, calories_target: 1800, dietary_pattern: "omnivore", dietary_tags: ["high_protein"], cuisines: ["Asian"], liked: ["chicken"], disliked: ["mushrooms"], allergens: [{ allergen: "peanuts", kind: "allergy", severity: "severe" }, { allergen: "milk", kind: "intolerance", severity: "moderate" }], budget_per_meal: 100, requires_professional_review: false, cooking_preference: "ready_to_heat" };

test("allergens exclude, intolerances penalise, reasons explain", () => {
  const ok = scoreMeal(meal({}), ctx, "lunch");
  assert.ok(!ok.excluded && ok.score > 70);
  assert.ok(ok.reasons.some((r) => r.includes("protein")));
  assert.ok(ok.reasons.some((r) => r.includes("Asian")));
  const peanut = scoreMeal(meal({ allergens: ["peanuts"] }), ctx, "lunch");
  assert.ok(peanut.excluded);
  const dairy = scoreMeal(meal({ allergens: ["milk"] }), ctx, "lunch");
  assert.ok(!dairy.excluded && dairy.score < ok.score);
  assert.ok(dairy.cautions.some((c) => c.includes("intolerance")));
  const mush = scoreMeal(meal({ ingredient_names: ["Mushrooms", "Rice"] }), ctx, "lunch");
  assert.ok(mush.cautions.some((c) => c.includes("disliked")));
});

test("dietary pattern exclusions and budget", () => {
  const vegan = { ...ctx, dietary_pattern: "vegan", allergens: [] };
  assert.ok(scoreMeal(meal({}), vegan, "lunch").excluded);
  assert.ok(!scoreMeal(meal({ dietary_tags: ["vegan"] }), vegan, "lunch").excluded);
  const pricey = scoreMeal(meal({ price: 150 }), ctx, "lunch");
  assert.ok(pricey.cautions.some((c) => c.includes("budget")));
});

test("recommend returns sorted non-excluded meals", () => {
  const meals = [meal({ id: 1 }), meal({ id: 2, allergens: ["peanuts"] }), meal({ id: 3, category: "dinner", nutrition: { kcal: 620, protein: 50, carbs: 50, fat: 20, fibre: 8, sodium_mg: 400, sugar: 2 } })];
  const r = recommend(meals, ctx, "lunch", 5);
  assert.equal(r.length, 2);
  assert.equal(r[0].meal.id, 1);
});

test("substitutions respond to allergens and pattern", () => {
  const s = suggestSubstitutions(["Peanut butter", "Greek yoghurt"], ctx);
  assert.ok(s.some((x) => x.ingredient === "Peanut butter"));
});

test("planner fills every slot, rotates meals and audits gaps", () => {
  const meals = [
    meal({ id: 1, category: "breakfast", nutrition: { kcal: 400, protein: 20, carbs: 50, fat: 10, fibre: 5, sodium_mg: 200, sugar: 10 } }),
    meal({ id: 2, category: "breakfast", name: "Eggs", nutrition: { kcal: 380, protein: 28, carbs: 10, fat: 25, fibre: 2, sodium_mg: 400, sugar: 2 } }),
    meal({ id: 3, category: "lunch" }), meal({ id: 4, category: "lunch", name: "Tuna salad" }),
    meal({ id: 5, category: "dinner", nutrition: { kcal: 600, protein: 45, carbs: 55, fat: 18, fibre: 8, sodium_mg: 500, sugar: 4 } }), meal({ id: 6, category: "dinner", name: "Curry", nutrition: { kcal: 650, protein: 35, carbs: 60, fat: 25, fibre: 6, sodium_mg: 700, sugar: 6 } }),
    meal({ id: 7, category: "snack", nutrition: { kcal: 180, protein: 15, carbs: 12, fat: 8, fibre: 2, sodium_mg: 100, sugar: 8 } }),
  ];
  const plan = generatePlan(meals, ctx, { meals_per_day: 3, include_snacks: true, targets: { calories_min: 1710, calories_max: 1890, protein_g: 130, fibre_g: 25, carbs_max_g: 220, fat_max_g: 70 } });
  assert.equal(plan.items.length, 28);
  assert.equal(slotsFor(3, true).length, 4);
  // variety: consecutive days should not repeat the same lunch when alternatives exist
  const lunches = plan.items.filter((i) => i.slot === "lunch").map((i) => i.meal.id);
  assert.ok(lunches.some((l, i) => i > 0 && l !== lunches[i - 1]));
  assert.equal(plan.audits.length, 7);
  // fibre gap detection
  const audits = auditPlan(plan.items.map((i) => ({ ...i, meal: { ...i.meal, nutrition: { ...i.meal.nutrition, fibre: 1 } } })), { meals_per_day: 3, include_snacks: true, targets: { calories_min: 1710, calories_max: 1890, protein_g: 130, fibre_g: 25, carbs_max_g: 220, fat_max_g: 70 } });
  assert.ok(audits.every((a) => a.gaps.some((g) => g.startsWith("Fibre"))));
});

test("grocery aggregation applies waste and nets stock", () => {
  const lines = aggregateRequirements(
    [{ meal_id: 1, servings: 40, portion_multiplier: 1 }, { meal_id: 2, servings: 10, portion_multiplier: 2 }],
    [{ meal_id: 1, ingredient_id: 1, quantity: 600, recipe_servings: 4 }, { meal_id: 2, ingredient_id: 1, quantity: 500, recipe_servings: 4 }, { meal_id: 1, ingredient_id: 2, quantity: 320, recipe_servings: 4 }],
    new Map([[1, { id: 1, name: "Chicken breast", category: "poultry", base_unit: "g", waste_pct: 10, stock: 2000, best_price: 0.089, best_supplier: "A", min_stock: 0 }], [2, { id: 2, name: "Rice", category: "grains", base_unit: "g", waste_pct: 0, stock: 10000, best_price: 0.03, best_supplier: "B", min_stock: 0 }]]),
    new Map([[1, "Bowl"], [2, "Wrap"]])
  );
  const chicken = lines.find((l) => l.ingredient_id === 1)!;
  assert.equal(chicken.required, 600 / 4 * 40 + 500 / 4 * 10 * 2); // 6000 + 2500
  assert.equal(chicken.with_waste, 8500 * 1.1);
  assert.equal(chicken.to_purchase, 8500 * 1.1 - 2000);
  assert.deepEqual(chicken.meals, ["Bowl", "Wrap"]);
  const rice = lines.find((l) => l.ingredient_id === 2)!;
  assert.equal(rice.to_purchase, 0);
  assert.equal(formatQty(18000, "g"), "18 kg");
  assert.equal(formatQty(750, "ml"), "750 ml");
  assert.equal(formatQty(120, "each"), "120");
});
