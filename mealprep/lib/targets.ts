import type Database from "better-sqlite3";
import type { NutritionTargets } from "./nutrition";

/** Upsert the derived nutrition-target cache for a client. */
export function writeTargets(db: Database.Database, clientId: number, t: NutritionTargets) {
  db.prepare(
    `INSERT INTO client_nutrition_targets (client_id, bmr, tdee, calories_min, calories_target, calories_max, protein_g, carbs_min_g, carbs_max_g,
       fat_min_g, fat_max_g, fibre_g, water_ml, method, flags_json, requires_professional_review, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(client_id) DO UPDATE SET bmr=excluded.bmr, tdee=excluded.tdee, calories_min=excluded.calories_min,
       calories_target=excluded.calories_target, calories_max=excluded.calories_max, protein_g=excluded.protein_g,
       carbs_min_g=excluded.carbs_min_g, carbs_max_g=excluded.carbs_max_g, fat_min_g=excluded.fat_min_g, fat_max_g=excluded.fat_max_g,
       fibre_g=excluded.fibre_g, water_ml=excluded.water_ml, method=excluded.method, flags_json=excluded.flags_json,
       requires_professional_review=excluded.requires_professional_review, computed_at=excluded.computed_at`
  ).run(
    clientId, t.bmr, t.tdee, t.calories_min, t.calories_target, t.calories_max, t.protein_g, t.carbs_min_g, t.carbs_max_g,
    t.fat_min_g, t.fat_max_g, t.fibre_g, t.water_ml, t.method, JSON.stringify(t.flags), t.requires_professional_review ? 1 : 0
  );
}
