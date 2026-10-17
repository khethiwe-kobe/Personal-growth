import { getDb, getSettingNumber } from "../db";
import type { IngredientRow, MealRow, RecipeIngredientRow, RecipeStep, Nutrition } from "../types";
import { parseJson } from "../types";
import { mealNutrition, mealCost, mealAllergens, grossMargin, type RecipeLine, type CostBreakdown } from "../costing";
import type { MealProfile } from "../recommend";
import { audit } from "../audit";
import { emit } from "../automation";

export type MealFull = {
  meal: MealRow;
  lines: RecipeLine[];
  steps: RecipeStep[];
  portion_note: string;
  nutrition: Nutrition;
  cost: CostBreakdown;
  margin: { profit: number; margin_pct: number };
  allergens: string[];
  tags: string[];
  rating: { avg: number | null; count: number };
};

export async function costSettings() {
  return {
    default_packaging_cost: await getSettingNumber("default_packaging_cost"),
    labour_rate_per_hour: await getSettingNumber("labour_rate_per_hour"),
    overhead_per_meal: await getSettingNumber("overhead_per_meal"),
  };
}

/** Best (lowest) supplier price per base unit, falling back to the ingredient default. */
export async function bestPrices(): Promise<Map<number, { price: number; supplier_id: number | null; supplier: string | null }>> {
  const db = getDb();
  const rows = await db.prepare(
    `SELECT i.id, i.default_cost_per_unit,
            (SELECT sp.price_per_unit FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.ingredient_id = i.id AND s.is_active = 1 ORDER BY sp.price_per_unit LIMIT 1) AS best,
            (SELECT s.id FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.ingredient_id = i.id AND s.is_active = 1 ORDER BY sp.price_per_unit LIMIT 1) AS sid,
            (SELECT s.name FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id WHERE sp.ingredient_id = i.id AND s.is_active = 1 ORDER BY sp.price_per_unit LIMIT 1) AS sname
       FROM ingredients i`
  ).all() as { id: number; default_cost_per_unit: number; best: number | null; sid: number | null; sname: string | null }[];
  const m = new Map<number, { price: number; supplier_id: number | null; supplier: string | null }>();
  for (const r of rows) m.set(r.id, { price: r.best ?? r.default_cost_per_unit, supplier_id: r.sid, supplier: r.sname });
  return m;
}

export async function stockByIngredient(): Promise<Map<number, number>> {
  const rows = await getDb().prepare("SELECT ingredient_id, SUM(quantity_remaining) AS q FROM inventory_lots GROUP BY ingredient_id").all() as { ingredient_id: number; q: number }[];
  return new Map(rows.map((r) => [r.ingredient_id, r.q]));
}

export async function listIngredients(activeOnly = true): Promise<IngredientRow[]> {
  return await getDb().prepare(`SELECT * FROM ingredients ${activeOnly ? "WHERE is_active = 1" : ""} ORDER BY category, name`).all() as IngredientRow[];
}

export async function getIngredient(id: number): Promise<IngredientRow | null> {
  return (await getDb().prepare("SELECT * FROM ingredients WHERE id = ?").get(id) as IngredientRow | undefined) ?? null;
}

export async function listMeals(activeOnly = true): Promise<MealRow[]> {
  return await getDb().prepare(`SELECT * FROM meals ${activeOnly ? "WHERE is_active = 1" : ""} ORDER BY category, name`).all() as MealRow[];
}

async function linesFor(mealId: number, prices?: Awaited<ReturnType<typeof bestPrices>>): Promise<RecipeLine[]> {
  prices ??= await bestPrices();
  const rows = await getDb().prepare(
    `SELECT ri.*, i.id AS i_id FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.meal_id = ? ORDER BY ri.sort_order, ri.id`
  ).all(mealId) as (RecipeIngredientRow & { i_id: number })[];
  const ingMap = new Map((await listIngredients(false)).map((i) => [i.id, i]));
  return rows.map((r) => ({ ...r, ingredient: ingMap.get(r.ingredient_id)!, price_per_unit: prices.get(r.ingredient_id)?.price ?? 0 }));
}

export async function getMealFull(id: number): Promise<MealFull | null> {
  const db = getDb();
  const meal = await db.prepare("SELECT * FROM meals WHERE id = ?").get(id) as MealRow | undefined;
  if (!meal) return null;
  const lines = await linesFor(id);
  const recipe = await db.prepare("SELECT steps_json, portion_note FROM recipes WHERE meal_id = ?").get(id) as { steps_json: string; portion_note: string } | undefined;
  const nutrition = mealNutrition(meal, lines);
  const cost = mealCost(meal, lines, await costSettings());
  const rating = await db.prepare("SELECT AVG(overall) AS avg, COUNT(*) AS count FROM feedback WHERE meal_id = ? AND overall IS NOT NULL").get(id) as { avg: number | null; count: number };
  return {
    meal, lines, steps: parseJson<RecipeStep[]>(recipe?.steps_json, []), portion_note: recipe?.portion_note ?? "",
    nutrition, cost, margin: grossMargin(meal.selling_price, cost.total), allergens: mealAllergens(lines),
    tags: parseJson<string[]>(meal.dietary_tags, []), rating: { avg: rating.avg, count: rating.count },
  };
}

/** All active meals as scoring profiles (one pass; used by recommender/planner/dashboards). */
export async function mealProfiles(clientId: number | null = null): Promise<MealProfile[]> {
  const db = getDb();
  const meals = await listMeals();
  const prices = await bestPrices();
  const stock = await stockByIngredient();
  const settings = await costSettings();
  const allIng = new Map((await listIngredients(false)).map((i) => [i.id, i]));
  const allLines = await db.prepare("SELECT * FROM recipe_ingredients ORDER BY sort_order, id").all() as RecipeIngredientRow[];
  const ratings = new Map((await db.prepare("SELECT meal_id, AVG(overall) AS avg FROM feedback WHERE overall IS NOT NULL GROUP BY meal_id").all() as { meal_id: number; avg: number }[]).map((r) => [r.meal_id, r.avg]));
  const ordered = new Map<number, number>();
  if (clientId) {
    for (const r of await db.prepare("SELECT oi.meal_id, COUNT(*) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.client_id = ? GROUP BY oi.meal_id").all(clientId) as { meal_id: number; n: number }[]) ordered.set(r.meal_id, r.n);
  }
  const month = new Date().getMonth() + 1;
  return meals.map((meal) => {
    const lines: RecipeLine[] = allLines.filter((l) => l.meal_id === meal.id).map((l) => ({ ...l, ingredient: allIng.get(l.ingredient_id)!, price_per_unit: prices.get(l.ingredient_id)?.price ?? 0 })).filter((l) => l.ingredient);
    const n = lines.length || 1;
    const inStock = lines.filter((l) => (stock.get(l.ingredient_id) ?? 0) >= l.quantity / Math.max(1, meal.servings)).length / n;
    const seasonal = lines.filter((l) => { const months = parseJson<number[]>(l.ingredient.seasonal_months, []); return months.length === 0 || months.includes(month); }).length / n;
    return {
      id: meal.id, name: meal.name, category: meal.category, cuisine: meal.cuisine,
      dietary_tags: parseJson<string[]>(meal.dietary_tags, []), allergens: mealAllergens(lines),
      ingredient_names: lines.map((l) => l.ingredient.name), nutrition: mealNutrition(meal, lines),
      cost: mealCost(meal, lines, settings).total, price: meal.selling_price, complexity: meal.complexity,
      bulk_friendly: !!meal.bulk_friendly, in_stock_ratio: inStock, seasonal_ratio: seasonal,
      avg_rating: ratings.get(meal.id) ?? null, times_ordered_by_client: ordered.get(meal.id) ?? 0,
    };
  });
}

export async function upsertMeal(data: Partial<MealRow> & { id?: number }, userId: number | null): Promise<number> {
  const db = getDb();
  const cols = ["name", "category", "cuisine", "description", "servings", "serving_size_g", "prep_minutes", "cook_minutes", "cook_temp_c", "shelf_life_days", "storage", "reheating", "food_safety_notes", "dietary_tags", "complexity", "bulk_friendly", "packaging_cost", "labour_minutes_per_serving", "selling_price", "tier", "image_url", "internal_rating", "nutrition_override", "is_active"] as const;
  if (data.id) {
    const present = cols.filter((c) => data[c] !== undefined);
    await db.prepare(`UPDATE meals SET ${present.map((c) => `${c} = ?`).join(", ")}, updated_at = now_text() WHERE id = ?`).run(...present.map((c) => data[c] as unknown), data.id);
    await audit(userId, "update", "meal", data.id, present.join(","));
    await checkMargin(data.id);
    return data.id;
  }
  const present = cols.filter((c) => data[c] !== undefined);
  const r = await db.prepare(`INSERT INTO meals (${present.join(", ")}) VALUES (${present.map(() => "?").join(", ")})`).run(...present.map((c) => data[c] as unknown));
  const id = Number(r.lastInsertRowid);
  await db.prepare("INSERT INTO recipes (meal_id) VALUES (?) ON CONFLICT DO NOTHING").run(id);
  await audit(userId, "create", "meal", id, data.name ?? "");
  return id;
}

export async function setRecipe(mealId: number, lines: { ingredient_id: number; quantity: number; note?: string }[], steps: RecipeStep[], portionNote: string, userId: number | null) {
  const db = getDb();
  await db.transaction(async () => {
    await db.prepare("DELETE FROM recipe_ingredients WHERE meal_id = ?").run(mealId);
    const ins = db.prepare("INSERT INTO recipe_ingredients (meal_id, ingredient_id, quantity, note, sort_order) VALUES (?, ?, ?, ?, ?)");
    for (const [i, l] of lines.entries()) if (l.ingredient_id && l.quantity > 0) await ins.run(mealId, l.ingredient_id, l.quantity, l.note ?? "", i);
    await db.prepare("INSERT INTO recipes (meal_id, steps_json, portion_note, updated_at) VALUES (?, ?, ?, now_text()) ON CONFLICT(meal_id) DO UPDATE SET steps_json = excluded.steps_json, portion_note = excluded.portion_note, updated_at = excluded.updated_at")
      .run(mealId, JSON.stringify(steps), portionNote);
  })();
  await audit(userId, "update", "recipe", mealId, `${lines.length} ingredients, ${steps.length} steps`);
  await checkMargin(mealId);
}

/** Pricing-review flag when a meal's margin falls below the conservative target. */
export async function checkMargin(mealId: number) {
  const full = await getMealFull(mealId);
  if (!full || full.meal.selling_price <= 0) return;
  const floor = await getSettingNumber("target_margin_conservative") * 100;
  if (full.margin.margin_pct < floor) await emit("meal.cost_changed", { meal_id: mealId, meal: full.meal.name, cost: full.cost.total, margin: full.margin.margin_pct });
}

export async function upsertIngredient(data: Partial<IngredientRow> & { id?: number }, userId: number | null): Promise<number> {
  const db = getDb();
  const cols = ["name", "category", "base_unit", "kcal_per_100", "protein_per_100", "carbs_per_100", "fat_per_100", "fibre_per_100", "sodium_mg_per_100", "sugar_per_100", "allergens", "default_cost_per_unit", "waste_pct", "seasonal_months", "min_stock", "storage", "is_active"] as const;
  const present = cols.filter((c) => data[c] !== undefined);
  if (data.id) {
    await db.prepare(`UPDATE ingredients SET ${present.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).run(...present.map((c) => data[c] as unknown), data.id);
    await audit(userId, "update", "ingredient", data.id, present.join(","));
    if (present.includes("default_cost_per_unit")) for (const m of await mealsUsingIngredient(data.id)) await checkMargin(m);
    return data.id;
  }
  const r = await db.prepare(`INSERT INTO ingredients (${present.join(", ")}) VALUES (${present.map(() => "?").join(", ")})`).run(...present.map((c) => data[c] as unknown));
  await audit(userId, "create", "ingredient", Number(r.lastInsertRowid), data.name ?? "");
  return Number(r.lastInsertRowid);
}

export async function mealsUsingIngredient(ingredientId: number): Promise<number[]> {
  return (await getDb().prepare("SELECT DISTINCT meal_id FROM recipe_ingredients WHERE ingredient_id = ?").all(ingredientId) as { meal_id: number }[]).map((r) => r.meal_id);
}

export async function mealPopularity(days = 90) {
  return await getDb().prepare(
    `SELECT m.id, m.name, m.category, m.selling_price,
            COALESCE(SUM(oi.quantity), 0) AS ordered,
            (SELECT AVG(f.overall) FROM feedback f WHERE f.meal_id = m.id) AS rating,
            (SELECT COUNT(*) FROM feedback f WHERE f.meal_id = m.id) AS ratings
       FROM meals m
       LEFT JOIN order_items oi ON oi.meal_id = m.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled' AND o.created_at >= date_text('now', ?)
      WHERE m.is_active = 1
      GROUP BY m.id ORDER BY ordered DESC, rating DESC`
  ).all(`-${days} days`) as { id: number; name: string; category: string; selling_price: number; ordered: number; rating: number | null; ratings: number }[];
}
