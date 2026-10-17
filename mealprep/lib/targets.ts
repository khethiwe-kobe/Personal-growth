import type { Db } from "./db";
import type { NutritionTargets } from "./nutrition";

/** Column values for the client_nutrition_targets cache. */
export function targetsRow(clientId: number, t: NutritionTargets) {
  return {
    client_id: clientId, bmr: t.bmr, tdee: t.tdee, calories_min: t.calories_min, calories_target: t.calories_target, calories_max: t.calories_max,
    protein_g: t.protein_g, carbs_min_g: t.carbs_min_g, carbs_max_g: t.carbs_max_g, fat_min_g: t.fat_min_g, fat_max_g: t.fat_max_g,
    fibre_g: t.fibre_g, water_ml: t.water_ml, method: t.method, flags_json: JSON.stringify(t.flags),
    requires_professional_review: t.requires_professional_review ? 1 : 0,
  };
}

/** Upsert the derived nutrition-target cache for a client. */
export async function writeTargets(db: Db, clientId: number, t: NutritionTargets) {
  const row = targetsRow(clientId, t);
  const cols = Object.keys(row);
  await db.prepare(
    `INSERT INTO client_nutrition_targets (${cols.join(", ")}, computed_at)
     VALUES (${cols.map(() => "?").join(", ")}, now_text())
     ON CONFLICT(client_id) DO UPDATE SET ${cols.slice(1).map((c) => `${c}=excluded.${c}`).join(", ")}, computed_at=excluded.computed_at`
  ).run(...Object.values(row));
}
