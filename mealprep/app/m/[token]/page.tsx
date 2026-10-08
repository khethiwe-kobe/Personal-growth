import { notFound } from "next/navigation";
import { labelByToken } from "@/lib/repo/production";
import { getMealFull } from "@/lib/repo/meals";
import { getSetting } from "@/lib/db";
import { ALLERGEN_LABELS } from "@/lib/types";
import { fmtDate } from "@/components/ui";
import Link from "next/link";

export default async function MealPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const l = labelByToken(token);
  if (!l) notFound();
  const m = getMealFull(l.meal_id);
  if (!m) notFound();
  const k = l.portion_multiplier;
  return (
    <div className="min-h-screen bg-bone">
      <div className="max-w-md mx-auto p-5 space-y-4">
        <div className="text-center pt-4"><div className="font-display text-lg">{getSetting("brand_name")}</div><div className="text-xs text-ink-3">Prepared for {l.first_name} · Meal {String(l.meal_number).padStart(2, "0")} of {l.total}</div></div>
        <div className="card p-5"><div className="kicker capitalize">{m.meal.category}</div><h1 className="text-2xl">{m.meal.name}</h1><p className="text-sm text-ink-2 mt-1">{m.meal.description}</p><div className="grid grid-cols-2 gap-2 text-xs mt-3"><div><span className="text-ink-3">Prepared</span><br />{fmtDate(l.prepared_on)}</div><div><span className="text-ink-3">Best before</span><br /><b>{fmtDate(l.best_before)}</b></div></div></div>
        <div className="card p-5"><div className="kicker mb-2">Nutrition per portion</div><table className="w-full text-sm"><tbody>{[["Energy", `${Math.round(m.nutrition.kcal * k)} kcal`], ["Protein", `${(m.nutrition.protein * k).toFixed(1)} g`], ["Carbohydrate", `${(m.nutrition.carbs * k).toFixed(1)} g`], ["Fat", `${(m.nutrition.fat * k).toFixed(1)} g`], ["Fibre", `${(m.nutrition.fibre * k).toFixed(1)} g`], ["Sodium", `${Math.round(m.nutrition.sodium_mg * k)} mg`]].map(([a, b]) => <tr key={a} className="border-b border-line/60 last:border-0"><td className="py-1 text-ink-2">{a}</td><td className="py-1 text-right font-medium">{b}</td></tr>)}</tbody></table></div>
        <div className="card p-5"><div className="kicker mb-2">Ingredients</div><p className="text-sm">{m.lines.map((x) => x.ingredient.name).join(", ")}.</p><div className="text-sm mt-2"><b>Allergens:</b> {m.allergens.length ? m.allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(", ") : "none declared"}</div></div>
        <div className="card p-5"><div className="kicker mb-2">Storage & reheating</div><p className="text-sm">{m.meal.storage}</p><p className="text-sm mt-1">{m.meal.reheating}</p>{m.meal.food_safety_notes && <p className="text-xs text-ink-2 mt-1">{m.meal.food_safety_notes}</p>}</div>
        <div className="card p-5"><div className="kicker mb-2">How it was made</div><ol className="text-sm list-decimal pl-5 space-y-1">{m.steps.map((s, i) => <li key={i}>{s.text}</li>)}</ol></div>
        <Link href={`/portal/feedback?order=${l.order_id}&meal=${l.meal_id}`} className="btn-primary w-full">Rate this meal</Link>
        <div className="text-[11px] text-ink-3 text-center pb-6">Nutrition values are estimates derived from recipe ingredients. Not medical advice.</div>
      </div>
    </div>
  );
}
