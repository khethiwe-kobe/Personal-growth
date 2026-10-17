import { requireClient } from "@/lib/auth";
import { getClientFull } from "@/lib/repo/clients";
import { Card, Stat, Disclaimer } from "@/components/ui";
import { PROFESSIONAL_REVIEW_MESSAGE } from "@/lib/nutrition";

export default async function Nutrition() {
  const user = await requireClient();
  const f = getClientFull(user.client_id)!;
  const t = f.computed;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">My nutrition summary</h1>
      <Disclaimer />
      {t.requires_professional_review && <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm px-4 py-3">{PROFESSIONAL_REVIEW_MESSAGE}</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Stat label="BMI" value={t.bmi ?? "—"} sub={t.bmi_category} /><Stat label="Estimated daily energy" value={t.calories_target ?? "—"} sub={`${t.calories_min ?? "—"}–${t.calories_max ?? "—"} kcal`} /><Stat label="Protein" value={t.protein_g ? `${t.protein_g} g` : "—"} /><Stat label="Water" value={t.water_ml ? `${(t.water_ml / 1000).toFixed(1)} L` : "—"} /></div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Daily ranges"><table className="table"><tbody><tr><td>Carbohydrate</td><td className="text-right">{t.carbs_min_g ?? "—"}–{t.carbs_max_g ?? "—"} g</td></tr><tr><td>Fat</td><td className="text-right">{t.fat_min_g ?? "—"}–{t.fat_max_g ?? "—"} g</td></tr><tr><td>Fibre</td><td className="text-right">{t.fibre_g} g</td></tr></tbody></table><ul className="text-xs text-ink-2 mt-3 list-disc pl-4">{t.goal_notes.map((g) => <li key={g}>{g}</li>)}<li>Calculated with the Mifflin-St Jeor equation and an activity multiplier.</li></ul></Card>
        <Card title="How your day is split"><table className="table"><tbody>{t.meal_distribution.map((d) => <tr key={d.slot}><td className="capitalize">{d.slot}</td><td className="text-right">{d.kcal ?? "—"} kcal</td></tr>)}</tbody></table>{f.health?.blood_type && <p className="text-xs text-ink-3 mt-3">Blood type on file: {f.health.blood_type} (informational only — it does not affect your plan).</p>}</Card>
      </div>
    </div>
  );
}
