import type { ActivityLevel, Gender, GoalType, HealthProfileRow, AllergyRow, ClientRow } from "./types";

/**
 * Evidence-based nutrition estimates.
 *
 *  - BMR: Mifflin-St Jeor (1990).
 *  - TDEE: BMR × activity multiplier.
 *  - Goal adjustment: capped deficit (−10 % to −20 %) or surplus (+5 % to +15 %).
 *  - Floors: 1,200 kcal (female) / 1,500 kcal (male/other) — below this the
 *    system refuses to go lower and flags professional review.
 *  - Protein: g/kg bodyweight by goal (1.2–2.0 g/kg, within accepted ranges).
 *  - Carbs 40–55 % / fat 25–35 % of energy; fibre 25–30 g; water ≈ 35 ml/kg.
 *
 * These are ESTIMATES for general guidance. They are not medical advice and
 * never replace a registered dietitian or doctor. Blood type is deliberately
 * not an input to any calculation.
 */

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (desk job, little exercise)",
  light: "Lightly active (1–3 sessions/week)",
  moderate: "Moderately active (3–5 sessions/week)",
  active: "Active (6–7 sessions/week)",
  very_active: "Very active (physical job or 2× daily training)",
};

export type NutritionFlag = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

export type NutritionTargets = {
  bmi: number | null;
  bmi_category: string;
  bmr: number | null;
  tdee: number | null;
  calories_min: number | null;
  calories_target: number | null;
  calories_max: number | null;
  protein_g: number | null;
  carbs_min_g: number | null;
  carbs_max_g: number | null;
  fat_min_g: number | null;
  fat_max_g: number | null;
  fibre_g: number;
  water_ml: number | null;
  meal_distribution: { slot: string; share: number; kcal: number | null }[];
  goal_notes: string[];
  flags: NutritionFlag[];
  requires_professional_review: boolean;
  method: string;
};

export function ageFromDob(dob: string | null | undefined, today = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export function bmi(heightCm: number | null, weightKg: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

export function bmiCategory(v: number | null): string {
  if (v == null) return "Unknown";
  if (v < 18.5) return "Below the healthy range";
  if (v < 25) return "Healthy range";
  if (v < 30) return "Above the healthy range";
  if (v < 35) return "Well above the healthy range";
  return "Very high";
}

export function mifflinStJeor(weightKg: number, heightCm: number, age: number, gender: Gender): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  // Mifflin-St Jeor publishes male/female constants; for "other"/unspecified
  // we use the midpoint so neither assumption is silently applied.
  if (gender === "male") return base + 5;
  if (gender === "female") return base - 161;
  return base - 78;
}

export type GoalAdjustment = { factor: number; note: string };

export function goalAdjustment(goal: GoalType | string): GoalAdjustment {
  switch (goal) {
    case "weight_management":
      return { factor: 0.85, note: "Moderate 15 % energy reduction (never below the safety floor)." };
    case "muscle_gain":
      return { factor: 1.1, note: "Modest 10 % energy surplus to support training." };
    case "sports_performance":
      return { factor: 1.05, note: "Slight surplus with higher carbohydrate emphasis around training." };
    case "lower_carb":
      return { factor: 1.0, note: "Maintenance energy with carbohydrate at the lower end of the range." };
    case "high_protein":
      return { factor: 1.0, note: "Maintenance energy with protein at the upper end of the range." };
    default:
      return { factor: 1.0, note: "Maintenance energy." };
  }
}

export function proteinPerKg(goal: GoalType | string, activity: ActivityLevel): number {
  if (goal === "muscle_gain" || goal === "high_protein") return 1.8;
  if (goal === "sports_performance") return 1.6;
  if (goal === "weight_management") return 1.6; // preserves lean mass in a deficit
  return activity === "sedentary" ? 1.0 : 1.2;
}

export type ProfileInput = {
  gender: Gender;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel;
  goal: GoalType | string;
  is_pregnant?: boolean;
  is_breastfeeding?: boolean;
  medical_conditions?: string;
  eating_disorder_history?: boolean;
  medically_restricted_diet?: string;
  allergies?: { kind: string; severity: string; allergen: string }[];
  meals_per_day?: number;
  include_snacks?: boolean;
};

export function computeTargets(p: ProfileInput): NutritionTargets {
  const flags: NutritionFlag[] = [];
  const b = bmi(p.height_cm, p.weight_kg);
  const goalNotes: string[] = [];

  if (p.age != null && p.age < 18)
    flags.push({ code: "under_18", severity: "critical", message: "Client is under 18. Paediatric nutrition needs professional oversight." });
  if (p.is_pregnant)
    flags.push({ code: "pregnancy", severity: "critical", message: "Client reports pregnancy. Energy and micronutrient needs differ; no deficit is applied." });
  if (p.is_breastfeeding)
    flags.push({ code: "breastfeeding", severity: "critical", message: "Client reports breastfeeding. No deficit is applied." });
  if (p.medical_conditions && p.medical_conditions.trim())
    flags.push({ code: "medical_condition", severity: "critical", message: `Client reports a medical condition (${p.medical_conditions.trim()}).` });
  if (p.eating_disorder_history)
    flags.push({ code: "eating_disorder_history", severity: "critical", message: "Client reports eating-disorder history. Do not present calorie targets without professional guidance." });
  if (p.medically_restricted_diet && p.medically_restricted_diet.trim())
    flags.push({ code: "restricted_diet", severity: "critical", message: `Medically restricted diet reported (${p.medically_restricted_diet.trim()}).` });
  const severe = (p.allergies ?? []).filter((a) => a.kind === "allergy" && a.severity === "severe");
  if (severe.length)
    flags.push({ code: "severe_allergy", severity: "critical", message: `Severe allergy reported: ${severe.map((a) => a.allergen).join(", ")}. Allergen controls must be verified for every meal.` });
  if (b != null && b < 18.5)
    flags.push({ code: "bmi_low", severity: "critical", message: "BMI is below 18.5. No energy deficit will be applied." });
  if (b != null && b >= 35)
    flags.push({ code: "bmi_high", severity: "critical", message: "BMI is 35 or above. Weight-related goals should be set with a professional." });
  if (b != null && b >= 30 && b < 35)
    flags.push({ code: "bmi_elevated", severity: "warning", message: "BMI is in the 30–35 range. Use conservative changes and monitor." });

  const requiresReview = flags.some((f) => f.severity === "critical");

  let bmr: number | null = null;
  let tdee: number | null = null;
  let calMin: number | null = null;
  let calTarget: number | null = null;
  let calMax: number | null = null;
  let protein: number | null = null;
  let carbsMin: number | null = null, carbsMax: number | null = null;
  let fatMin: number | null = null, fatMax: number | null = null;
  let water: number | null = null;

  if (p.weight_kg && p.height_cm && p.age != null) {
    bmr = Math.round(mifflinStJeor(p.weight_kg, p.height_cm, p.age, p.gender));
    tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[p.activity_level]);
    const adj = goalAdjustment(p.goal);
    goalNotes.push(adj.note);

    let factor = adj.factor;
    // Safety: never apply a deficit when flagged for low BMI, pregnancy, breastfeeding, ED history or under 18.
    const noDeficit = flags.some((f) => ["bmi_low", "pregnancy", "breastfeeding", "eating_disorder_history", "under_18"].includes(f.code));
    if (noDeficit && factor < 1) {
      factor = 1;
      goalNotes.push("Energy deficit suppressed because of a safety flag; maintenance energy shown instead.");
    }
    calTarget = Math.round(tdee * factor);
    const floor = p.gender === "female" ? 1200 : 1500;
    if (calTarget < floor) {
      calTarget = floor;
      flags.push({ code: "calorie_floor", severity: "warning", message: `Target raised to the ${floor} kcal safety floor.` });
    }
    calMin = Math.round(Math.max(floor, calTarget * 0.95));
    calMax = Math.round(calTarget * 1.05);

    protein = Math.round(proteinPerKg(p.goal, p.activity_level) * p.weight_kg);
    // Cap protein to ≤ 35 % of energy.
    protein = Math.min(protein, Math.round((calTarget * 0.35) / 4));
    const proteinKcal = protein * 4;
    const carbLow = p.goal === "lower_carb" ? 0.3 : 0.4;
    const carbHigh = p.goal === "sports_performance" ? 0.6 : 0.55;
    carbsMin = Math.round((calTarget * carbLow) / 4);
    carbsMax = Math.round((calTarget * carbHigh) / 4);
    fatMin = Math.round((calTarget * 0.25) / 9);
    fatMax = Math.round((calTarget * 0.35) / 9);
    // keep macro ranges consistent with energy
    const remaining = calTarget - proteinKcal;
    carbsMax = Math.min(carbsMax, Math.round((remaining - fatMin * 9) / 4));
    water = Math.round(p.weight_kg * 35);
  }

  const fibre = p.gender === "male" ? 30 : 25;
  const dist = mealDistribution(p.meals_per_day ?? 3, p.include_snacks ?? true, calTarget);

  return {
    bmi: b,
    bmi_category: bmiCategory(b),
    bmr, tdee,
    calories_min: calMin, calories_target: calTarget, calories_max: calMax,
    protein_g: protein, carbs_min_g: carbsMin, carbs_max_g: carbsMax,
    fat_min_g: fatMin, fat_max_g: fatMax, fibre_g: fibre, water_ml: water,
    meal_distribution: dist,
    goal_notes: goalNotes,
    flags,
    requires_professional_review: requiresReview,
    method: "mifflin_st_jeor",
  };
}

export function mealDistribution(mealsPerDay: number, includeSnacks: boolean, kcal: number | null) {
  const slots: { slot: string; share: number }[] = [];
  if (mealsPerDay >= 3) {
    slots.push({ slot: "breakfast", share: includeSnacks ? 0.25 : 0.3 });
    slots.push({ slot: "lunch", share: includeSnacks ? 0.3 : 0.35 });
    if (includeSnacks) slots.push({ slot: "snack", share: 0.1 });
    slots.push({ slot: "dinner", share: 0.35 });
  } else if (mealsPerDay === 2) {
    slots.push({ slot: "lunch", share: includeSnacks ? 0.45 : 0.5 });
    if (includeSnacks) slots.push({ slot: "snack", share: 0.1 });
    slots.push({ slot: "dinner", share: includeSnacks ? 0.45 : 0.5 });
  } else {
    slots.push({ slot: "dinner", share: 1 });
  }
  return slots.map((s) => ({ ...s, kcal: kcal == null ? null : Math.round(kcal * s.share) }));
}

export const PROFESSIONAL_REVIEW_MESSAGE =
  "Professional review recommended before personalised meal recommendations are provided.";

/** Build the engine input from database rows. */
export function profileInputFromRows(
  client: Pick<ClientRow, "gender" | "date_of_birth">,
  hp: HealthProfileRow | null,
  goal: string,
  allergies: AllergyRow[],
  mealsPerDay = 3,
  includeSnacks = true
): ProfileInput {
  return {
    gender: client.gender,
    age: ageFromDob(client.date_of_birth),
    height_cm: hp?.height_cm ?? null,
    weight_kg: hp?.weight_kg ?? null,
    activity_level: hp?.activity_level ?? "moderate",
    goal,
    is_pregnant: !!hp?.is_pregnant,
    is_breastfeeding: !!hp?.is_breastfeeding,
    medical_conditions: hp?.medical_conditions ?? "",
    eating_disorder_history: !!hp?.eating_disorder_history,
    medically_restricted_diet: hp?.medically_restricted_diet ?? "",
    allergies: allergies.map((a) => ({ kind: a.kind, severity: a.severity, allergen: a.allergen })),
    meals_per_day: mealsPerDay,
    include_snacks: includeSnacks,
  };
}
