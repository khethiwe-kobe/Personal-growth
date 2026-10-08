import type { Nutrition, Slot } from "./types";
import { SLOTS, DAY_NAMES, ZERO_NUTRITION } from "./types";
import { addNutrition, roundNutrition } from "./costing";
import { scoreMeal, type ClientContext, type MealProfile, type Scored } from "./recommend";

/**
 * Weekly plan generator. Picks the best-scoring meal per slot per day while
 * rotating for variety, then audits every day against the client's targets.
 */

export type PlanItem = { day_index: number; slot: Slot; meal: MealProfile; score: number; reasons: string[]; cautions: string[] };
export type DayAudit = {
  day_index: number;
  day: string;
  totals: Nutrition;
  gaps: string[];
  cost: number;
  price: number;
};
export type GeneratedPlan = { items: PlanItem[]; audits: DayAudit[]; week_gaps: string[]; suggestions: string[] };

export type PlanOptions = {
  meals_per_day: number;
  include_snacks: boolean;
  days?: number; // default 7
  variety_penalty?: number; // score penalty per prior use in the week
  budget_per_week?: number | null;
  targets: { calories_min: number | null; calories_max: number | null; protein_g: number | null; fibre_g: number; carbs_max_g: number | null; fat_max_g: number | null };
};

export function slotsFor(mealsPerDay: number, includeSnacks: boolean): Slot[] {
  const out: Slot[] = [];
  if (mealsPerDay >= 3) out.push("breakfast", "lunch");
  else if (mealsPerDay === 2) out.push("lunch");
  if (includeSnacks) out.push("snack");
  out.push("dinner");
  return out.filter((s) => SLOTS.includes(s));
}

export function generatePlan(meals: MealProfile[], ctx: ClientContext, opts: PlanOptions): GeneratedPlan {
  const days = opts.days ?? 7;
  const penalty = opts.variety_penalty ?? 18;
  const slots = slotsFor(opts.meals_per_day, opts.include_snacks);
  const used = new Map<number, number>();
  const items: PlanItem[] = [];

  for (let d = 0; d < days; d++) {
    for (const slot of slots) {
      const scored = meals
        .map((m) => scoreMeal(m, ctx, slot))
        .filter((s) => !s.excluded && s.score > 0)
        .map((s) => ({ ...s, adj: s.score - penalty * (used.get(s.meal.id) ?? 0) - (wasYesterday(items, d, s.meal.id) ? 25 : 0) }))
        .sort((a, b) => b.adj - a.adj);
      const pick = scored[0];
      if (!pick) continue;
      used.set(pick.meal.id, (used.get(pick.meal.id) ?? 0) + 1);
      items.push({ day_index: d, slot, meal: pick.meal, score: pick.score, reasons: pick.reasons, cautions: pick.cautions });
    }
  }
  const audits = auditPlan(items, opts, days);
  const week_gaps = audits.flatMap((a) => a.gaps.map((g) => `${a.day}: ${g}`));
  const suggestions = buildSuggestions(audits, meals, ctx);
  const weekPrice = audits.reduce((s, a) => s + a.price, 0);
  if (opts.budget_per_week && weekPrice > opts.budget_per_week) {
    suggestions.unshift(`Plan price R${weekPrice.toFixed(0)} exceeds the weekly budget of R${opts.budget_per_week}. Consider swapping premium-tier meals for standard ones.`);
  }
  return { items, audits, week_gaps, suggestions };
}

function wasYesterday(items: PlanItem[], day: number, mealId: number): boolean {
  return items.some((i) => i.day_index === day - 1 && i.meal.id === mealId);
}

export function auditPlan(items: PlanItem[], opts: PlanOptions, days = 7): DayAudit[] {
  const t = opts.targets;
  const audits: DayAudit[] = [];
  for (let d = 0; d < days; d++) {
    const dayItems = items.filter((i) => i.day_index === d);
    let totals = { ...ZERO_NUTRITION };
    let cost = 0, price = 0;
    for (const i of dayItems) { totals = addNutrition(totals, i.meal.nutrition); cost += i.meal.cost; price += i.meal.price; }
    totals = roundNutrition(totals);
    const gaps: string[] = [];
    if (dayItems.length === 0) { gaps.push("No meals planned."); }
    else {
      if (t.protein_g && totals.protein < t.protein_g * 0.9) gaps.push(`Protein is below the target (${totals.protein} g vs ${t.protein_g} g).`);
      if (t.calories_min && totals.kcal < t.calories_min * 0.9) gaps.push(`Energy is below the target range (${totals.kcal} kcal vs ${t.calories_min}–${t.calories_max} kcal).`);
      if (t.calories_max && totals.kcal > t.calories_max * 1.1) gaps.push(`Energy is above the target range (${totals.kcal} kcal vs ${t.calories_min}–${t.calories_max} kcal).`);
      if (totals.fibre < t.fibre_g * 0.8) gaps.push(`Fibre is below the target (${totals.fibre} g vs ${t.fibre_g} g).`);
      if (t.carbs_max_g && totals.carbs > t.carbs_max_g * 1.15) gaps.push(`Carbohydrate is above the upper range (${totals.carbs} g vs ${t.carbs_max_g} g).`);
      if (t.fat_max_g && totals.fat > t.fat_max_g * 1.15) gaps.push(`Fat is above the upper range (${totals.fat} g vs ${t.fat_max_g} g).`);
    }
    audits.push({ day_index: d, day: DAY_NAMES[d] ?? `Day ${d + 1}`, totals, gaps, cost: Math.round(cost * 100) / 100, price });
  }
  return audits;
}

function buildSuggestions(audits: DayAudit[], meals: MealProfile[], ctx: ClientContext): string[] {
  const out: string[] = [];
  const proteinDays = audits.filter((a) => a.gaps.some((g) => g.startsWith("Protein")));
  if (proteinDays.length) {
    const best = meals
      .map((m) => scoreMeal(m, ctx, "snack"))
      .filter((s) => !s.excluded)
      .sort((a, b) => b.meal.nutrition.protein - a.meal.nutrition.protein)[0];
    if (best) out.push(`Add a higher-protein snack such as "${best.meal.name}" (${best.meal.nutrition.protein} g protein) on ${proteinDays.map((d) => d.day).join(", ")}.`);
  }
  const fibreDays = audits.filter((a) => a.gaps.some((g) => g.startsWith("Fibre")));
  if (fibreDays.length) out.push(`Increase fibre on ${fibreDays.map((d) => d.day).join(", ")}: add a side of vegetables, legumes or whole grains.`);
  const highEnergy = audits.filter((a) => a.gaps.some((g) => g.startsWith("Energy is above")));
  if (highEnergy.length) out.push(`Reduce portion multiplier or swap dinner for a lighter option on ${highEnergy.map((d) => d.day).join(", ")}.`);
  const lowEnergy = audits.filter((a) => a.gaps.some((g) => g.startsWith("Energy is below")));
  if (lowEnergy.length) out.push(`Energy is low on ${lowEnergy.map((d) => d.day).join(", ")}: increase the portion multiplier to 1.25 or add a snack.`);
  return out;
}

export function planTotals(audits: DayAudit[]) {
  const daysWithMeals = audits.filter((a) => a.totals.kcal > 0).length || 1;
  const sum = audits.reduce((s, a) => addNutrition(s, a.totals), { ...ZERO_NUTRITION });
  const avg = roundNutrition({
    kcal: sum.kcal / daysWithMeals, protein: sum.protein / daysWithMeals, carbs: sum.carbs / daysWithMeals,
    fat: sum.fat / daysWithMeals, fibre: sum.fibre / daysWithMeals, sodium_mg: sum.sodium_mg / daysWithMeals, sugar: sum.sugar / daysWithMeals,
  });
  return { avg, cost: audits.reduce((s, a) => s + a.cost, 0), price: audits.reduce((s, a) => s + a.price, 0) };
}

export type { Scored };
