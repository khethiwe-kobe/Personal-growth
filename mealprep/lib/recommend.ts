import type { MealCategory, Nutrition, Slot } from "./types";

/**
 * Recommendation engine. Every candidate meal is scored against the client's
 * targets and preferences; every score carries human-readable reasons so the
 * planner (and the client) can see WHY a meal was suggested or excluded.
 */

export type MealProfile = {
  id: number;
  name: string;
  category: MealCategory;
  cuisine: string;
  dietary_tags: string[];
  allergens: string[];
  ingredient_names: string[];
  nutrition: Nutrition;
  cost: number;
  price: number;
  complexity: number;
  bulk_friendly: boolean;
  in_stock_ratio: number; // 0..1 share of ingredients with stock on hand
  seasonal_ratio: number; // 0..1 share of ingredients in season
  avg_rating: number | null;
  times_ordered_by_client: number;
};

export type ClientContext = {
  slot_kcal: Record<string, number | null>; // from meal distribution
  protein_target: number | null;
  calories_target: number | null;
  dietary_pattern: string;
  dietary_tags: string[];
  cuisines: string[];
  liked: string[];
  disliked: string[];
  allergens: { allergen: string; kind: string; severity: string }[];
  budget_per_meal: number | null;
  requires_professional_review: boolean;
  cooking_preference: string;
};

export type Scored = {
  meal: MealProfile;
  score: number;
  excluded: boolean;
  reasons: string[];
  cautions: string[];
};

const PATTERN_EXCLUDES: Record<string, (m: MealProfile) => boolean> = {
  vegan: (m) => !m.dietary_tags.includes("vegan"),
  vegetarian: (m) => !(m.dietary_tags.includes("vegetarian") || m.dietary_tags.includes("vegan")),
  pescatarian: (m) => !(m.dietary_tags.includes("pescatarian") || m.dietary_tags.includes("vegetarian") || m.dietary_tags.includes("vegan")),
  halal: (m) => !m.dietary_tags.includes("halal") && m.ingredient_names.some((n) => /pork|bacon|ham|wine/i.test(n)),
};

function matchesFood(list: string[], names: string[]): string[] {
  const hits: string[] = [];
  for (const f of list) {
    const needle = f.toLowerCase().trim();
    if (!needle) continue;
    if (names.some((n) => n.toLowerCase().includes(needle))) hits.push(f);
  }
  return hits;
}

export function scoreMeal(m: MealProfile, c: ClientContext, slot: Slot | null): Scored {
  const reasons: string[] = [];
  const cautions: string[] = [];
  let score = 50;

  // Hard exclusions ------------------------------------------------------
  for (const a of c.allergens) {
    const key = a.allergen.toLowerCase().replace(/\s+/g, "_");
    const inAllergens = m.allergens.includes(key);
    const inIngredients = m.ingredient_names.some((n) => n.toLowerCase().includes(a.allergen.toLowerCase()));
    if (inAllergens || inIngredients) {
      if (a.kind === "allergy" || a.kind === "medical") return { meal: m, score: 0, excluded: true, reasons: [], cautions: [`Excluded: contains ${a.allergen} (${a.kind}, ${a.severity}).`] };
      if (a.kind === "intolerance") { score -= 40; cautions.push(`Contains ${a.allergen} (intolerance).`); }
      if (a.kind === "avoid") { score -= 25; cautions.push(`Contains ${a.allergen} (client prefers to avoid).`); }
    }
  }
  const ex = PATTERN_EXCLUDES[c.dietary_pattern];
  if (ex && ex(m)) return { meal: m, score: 0, excluded: true, reasons: [], cautions: [`Excluded: not compatible with a ${c.dietary_pattern} pattern.`] };

  const dislikedHits = matchesFood(c.disliked, m.ingredient_names.concat(m.name));
  if (dislikedHits.length) { score -= 20 * dislikedHits.length; cautions.push(`Contains disliked food: ${dislikedHits.join(", ")}.`); }

  // Slot / category fit --------------------------------------------------
  if (slot) {
    const fits = slot === "snack" ? ["snack", "drink", "dessert"].includes(m.category) : m.category === slot;
    if (fits) { score += 10; reasons.push(`Suitable for ${slot}.`); }
    else score -= 30;
  }

  // Energy fit -----------------------------------------------------------
  const target = slot ? c.slot_kcal[slot] : null;
  if (target) {
    const diff = Math.abs(m.nutrition.kcal - target) / target;
    if (diff <= 0.15) { score += 15; reasons.push(`Energy (${m.nutrition.kcal} kcal) fits the ${slot} allowance (~${target} kcal).`); }
    else if (diff <= 0.3) { score += 5; reasons.push(`Energy is close to the ${slot} allowance.`); }
    else { score -= 10; cautions.push(`Energy is ${m.nutrition.kcal > target ? "above" : "below"} the ${slot} allowance (${m.nutrition.kcal} vs ~${target} kcal).`); }
  }

  // Protein --------------------------------------------------------------
  if (c.protein_target && c.calories_target) {
    const proteinShare = (m.nutrition.protein * 4) / Math.max(1, m.nutrition.kcal);
    const targetShare = (c.protein_target * 4) / c.calories_target;
    if (proteinShare >= targetShare) { score += 12; reasons.push(`Protein density (${m.nutrition.protein} g) supports the daily protein target.`); }
    else if (proteinShare >= targetShare * 0.75) { score += 4; }
    else cautions.push("Lower in protein than the client's target ratio.");
  }

  // Dietary tags ---------------------------------------------------------
  const tagHits = c.dietary_tags.filter((t) => m.dietary_tags.includes(t));
  if (tagHits.length) { score += 6 * tagHits.length; reasons.push(`Matches preferences: ${tagHits.map(prettyTag).join(", ")}.`); }
  const wantsLowerCarb = c.dietary_tags.includes("lower_carb");
  if (wantsLowerCarb && m.nutrition.carbs > 60) { score -= 8; cautions.push("Higher in carbohydrate than a lower-carb preference suggests."); }

  // Fibre / vegetables ---------------------------------------------------
  if (m.nutrition.fibre >= 6) { score += 5; reasons.push("Good source of fibre."); }
  if (m.ingredient_names.some((n) => /broccoli|spinach|pepper|carrot|zucchini|courgette|kale|tomato|cabbage|green beans|salad|lettuce|cauliflower|butternut|onion/i.test(n))) {
    score += 4; reasons.push("Contains vegetables.");
  }

  // Likes / cuisine ------------------------------------------------------
  const likedHits = matchesFood(c.liked, m.ingredient_names.concat(m.name));
  if (likedHits.length) { score += 8 * Math.min(2, likedHits.length); reasons.push(`Includes foods the client likes: ${likedHits.join(", ")}.`); }
  if (c.cuisines.length && m.cuisine && c.cuisines.map((x) => x.toLowerCase()).includes(m.cuisine.toLowerCase())) { score += 6; reasons.push(`${m.cuisine} cuisine is a stated preference.`); }

  // Budget ---------------------------------------------------------------
  if (c.budget_per_meal) {
    if (m.price <= c.budget_per_meal) { score += 6; reasons.push(`Within the per-meal budget (R${m.price} ≤ R${c.budget_per_meal}).`); }
    else { score -= 12; cautions.push(`Above the per-meal budget (R${m.price} > R${c.budget_per_meal}).`); }
  }

  // Operations -----------------------------------------------------------
  if (m.bulk_friendly) { score += 5; reasons.push("Suitable for meal prep and bulk production."); }
  if (m.complexity <= 2) { score += 3; reasons.push("Low preparation complexity."); }
  if (m.in_stock_ratio >= 0.8) { score += 5; reasons.push("Most ingredients already in stock."); }
  if (m.seasonal_ratio >= 0.8) { score += 3; reasons.push("Uses in-season ingredients."); }
  if (m.avg_rating != null && m.avg_rating >= 4.2) { score += 5; reasons.push(`Highly rated by clients (${m.avg_rating.toFixed(1)}/5).`); }
  if (m.times_ordered_by_client > 0) { score += 2; reasons.push("Client has enjoyed this before."); }

  if (c.requires_professional_review) cautions.push("Preliminary suggestion only — professional review is pending for this client.");

  return { meal: m, score: Math.max(0, Math.min(100, Math.round(score))), excluded: false, reasons, cautions };
}

export function recommend(meals: MealProfile[], c: ClientContext, slot: Slot | null, limit = 8): Scored[] {
  return meals
    .map((m) => scoreMeal(m, c, slot))
    .filter((s) => !s.excluded)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function excluded(meals: MealProfile[], c: ClientContext): Scored[] {
  return meals.map((m) => scoreMeal(m, c, null)).filter((s) => s.excluded);
}

/** Ingredient substitutions for common exclusions. */
export const SUBSTITUTIONS: { when: RegExp; suggest: string; because: string }[] = [
  { when: /milk|cream|yoghurt|yogurt|cheese/i, suggest: "Coconut or oat alternative", because: "dairy-free" },
  { when: /wheat|pasta|couscous|bread/i, suggest: "Rice, quinoa or gluten-free pasta", because: "gluten-free" },
  { when: /peanut/i, suggest: "Sunflower seed butter", because: "peanut allergy" },
  { when: /soy/i, suggest: "Coconut aminos", because: "soy allergy" },
  { when: /egg/i, suggest: "Chickpea flour scramble / flax egg", because: "egg allergy" },
  { when: /chicken/i, suggest: "Firm tofu or tempeh", because: "plant-based" },
  { when: /beef|lamb|pork/i, suggest: "Lentils or mushrooms", because: "plant-based / lower cost" },
  { when: /rice/i, suggest: "Cauliflower rice", because: "lower-carb preference" },
];

export function suggestSubstitutions(ingredientNames: string[], c: ClientContext): { ingredient: string; suggest: string; because: string }[] {
  const out: { ingredient: string; suggest: string; because: string }[] = [];
  const wants = new Set<string>();
  for (const a of c.allergens) wants.add(a.allergen.toLowerCase());
  if (c.dietary_pattern === "vegan" || c.dietary_pattern === "vegetarian") wants.add("plant-based");
  for (const t of c.dietary_tags) wants.add(prettyTag(t).toLowerCase());
  for (const n of ingredientNames) {
    for (const s of SUBSTITUTIONS) {
      if (!s.when.test(n)) continue;
      const relevant = [...wants].some((w) => { const stem = w.replace(/s$/, ""); return s.because.includes(stem) || n.toLowerCase().includes(stem); });
      if (relevant) out.push({ ingredient: n, suggest: s.suggest, because: s.because });
    }
  }
  return out;
}

export function prettyTag(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace("Fodmap", "FODMAP");
}
