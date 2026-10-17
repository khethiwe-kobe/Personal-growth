import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/auth";
import { getMealFull, listIngredients, getIngredient } from "@/lib/repo/meals";
import { getSettingNumber } from "@/lib/db";
import { PageHeader, Card, CategoryBadge, Tabs, Field, StatusBadge, Stat } from "@/components/ui";
import { formatZar, scaleRecipe, pricingScenarios } from "@/lib/costing";
import { formatQty } from "@/lib/grocery";
import { saveMeal, saveRecipe } from "@/app/actions";
import MealForm from "@/components/MealForm";
import { ALLERGEN_LABELS } from "@/lib/types";
import { prettyTag } from "@/lib/recommend";
import { getDb } from "@/lib/db";

const TABS = [{ key: "overview", label: "Overview" }, { key: "recipe", label: "Recipe & scaling" }, { key: "edit", label: "Edit meal" }];

export default async function MealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; servings?: string }> }) {
  const user = await requirePermission("meals:view");
  const { id } = await params;
  const { tab = "overview", servings } = await searchParams;
  const full = getMealFull(Number(id));
  if (!full) notFound();
  const { meal, lines, steps, nutrition, cost, margin, allergens, tags, rating } = full;
  const target = Number(servings) || 40;
  const scaled = scaleRecipe(meal, lines, target);
  const scenarios = pricingScenarios(cost.total, { conservative: getSettingNumber("target_margin_conservative"), standard: getSettingNumber("target_margin_standard"), premium: getSettingNumber("target_margin_premium") });
  const feedback = getDb().prepare("SELECT f.*, c.first_name FROM feedback f JOIN clients c ON c.id = f.client_id WHERE f.meal_id = ? ORDER BY f.created_at DESC LIMIT 8").all(meal.id) as { id: number; overall: number | null; taste: number | null; comment: string; first_name: string; created_at: string }[];
  const sold = getDb().prepare("SELECT COALESCE(SUM(oi.quantity),0) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.meal_id = ? AND o.status != 'cancelled'").get(meal.id) as { n: number };

  return (
    <div>
      <PageHeader kicker={<CategoryBadge category={meal.category} />} title={meal.name} actions={<Link href="/meals" className="btn-secondary btn-sm">All meals</Link>}>{meal.description}</PageHeader>
      <Tabs tabs={TABS} active={tab} base={`/meals/${meal.id}`} />

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <Stat label="Selling price" value={formatZar(meal.selling_price)} sub={meal.tier + " tier"} />
            <Stat label="True cost / serving" value={formatZar(cost.total)} sub={`ingredients ${formatZar(cost.ingredients)}`} />
            <Stat label="Gross profit" value={formatZar(margin.profit)} sub={`${margin.margin_pct}% margin`} tone={margin.margin_pct >= getSettingNumber("target_margin_conservative") * 100 ? "good" : "critical"} />
            <Stat label="Servings sold" value={sold.n} sub="all time" />
            <Stat label="Client rating" value={rating.avg ? rating.avg.toFixed(1) : "—"} sub={`${rating.count} reviews · internal ${meal.internal_rating}/5`} />
            <Stat label="Shelf life" value={`${meal.shelf_life_days} d`} sub={`${meal.serving_size_g} g serving`} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Nutrition per serving" kicker="Derived from recipe">
              <table className="table"><tbody>
                <tr><td>Energy</td><td className="text-right">{nutrition.kcal} kcal</td></tr>
                <tr><td>Protein</td><td className="text-right">{nutrition.protein} g</td></tr>
                <tr><td>Carbohydrate</td><td className="text-right">{nutrition.carbs} g</td></tr>
                <tr><td className="pl-6 text-ink-2">of which sugars</td><td className="text-right text-ink-2">{nutrition.sugar} g</td></tr>
                <tr><td>Fat</td><td className="text-right">{nutrition.fat} g</td></tr>
                <tr><td>Fibre</td><td className="text-right">{nutrition.fibre} g</td></tr>
                <tr><td>Sodium</td><td className="text-right">{nutrition.sodium_mg} mg</td></tr>
              </tbody></table>
              <div className="flex flex-wrap gap-1 mt-3">{tags.map((t) => <span key={t} className="badge bg-bone-2 text-ink-2">{prettyTag(t)}</span>)}</div>
              <div className="mt-2 text-xs"><b>Allergens:</b> {allergens.length ? allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(", ") : "none declared"}</div>
            </Card>
            <Card title="Cost breakdown" kicker="Per serving">
              <table className="table"><tbody>
                <tr><td>Ingredients (best supplier price)</td><td className="text-right">{formatZar(cost.ingredients)}</td></tr>
                <tr><td>Packaging</td><td className="text-right">{formatZar(cost.packaging)}</td></tr>
                <tr><td>Labour ({meal.labour_minutes_per_serving} min)</td><td className="text-right">{formatZar(cost.labour)}</td></tr>
                <tr><td>Overhead</td><td className="text-right">{formatZar(cost.overhead)}</td></tr>
                <tr className="font-medium"><td>True cost</td><td className="text-right">{formatZar(cost.total)}</td></tr>
              </tbody></table>
              <div className="kicker mt-4 mb-1">Pricing scenarios</div>
              <table className="table"><thead><tr><th>Scenario</th><th>Margin</th><th>Price</th><th>Profit</th></tr></thead><tbody>{scenarios.map((s) => <tr key={s.name}><td>{s.name}</td><td>{Math.round(s.margin * 100)}%</td><td>{formatZar(s.price)}</td><td>{formatZar(s.profit)}</td></tr>)}</tbody></table>
            </Card>
            <Card title="Storage, reheating & safety">
              <dl className="text-sm space-y-2">
                <div><dt className="kicker">Storage</dt><dd>{meal.storage}</dd></div>
                <div><dt className="kicker">Reheating</dt><dd>{meal.reheating}</dd></div>
                <div><dt className="kicker">Food safety</dt><dd>{meal.food_safety_notes || "Standard controls: cool within 90 min, chill ≤ 4 °C, reheat to 75 °C core."}</dd></div>
                <div><dt className="kicker">Preparation</dt><dd>{meal.prep_minutes} min prep · {meal.cook_minutes} min cook{meal.cook_temp_c ? ` · ${meal.cook_temp_c} °C` : ""} · complexity {meal.complexity}/5 · {meal.bulk_friendly ? "bulk-friendly" : "not bulk-friendly"}</dd></div>
              </dl>
              {feedback.length > 0 && <><div className="kicker mt-4 mb-1">Recent feedback</div><ul className="text-xs space-y-1">{feedback.map((f) => <li key={f.id}><b>{f.overall}/5</b> {f.first_name}: {f.comment || <span className="text-ink-3">no comment</span>}</li>)}</ul></>}
            </Card>
          </div>
        </div>
      )}

      {tab === "recipe" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title={`Recipe · yields ${meal.servings}`} kicker="Ingredients" className="lg:col-span-2">
            <table className="table"><thead><tr><th>Ingredient</th><th>Per recipe</th><th>Per serving</th><th>Cost</th></tr></thead><tbody>{lines.map((l) => <tr key={l.id}><td>{l.ingredient.name}{l.note && <span className="text-xs text-ink-3"> · {l.note}</span>}</td><td>{formatQty(l.quantity, l.ingredient.base_unit)}</td><td>{formatQty(l.quantity / meal.servings, l.ingredient.base_unit)}</td><td>{formatZar(l.quantity * l.price_per_unit)}</td></tr>)}</tbody></table>
            <div className="kicker mt-5 mb-2">Method</div>
            <ol className="text-sm space-y-2 list-decimal pl-5">{steps.map((s, i) => <li key={i}>{s.text}</li>)}</ol>
            {full.portion_note && <div className="text-xs text-ink-2 mt-3"><b>Portion:</b> {full.portion_note}</div>}
          </Card>
          <Card title="Scale for production" kicker="Purchasing quantities">
            <form className="flex gap-2 mb-3"><input type="hidden" name="tab" value="recipe" /><input name="servings" type="number" min={1} defaultValue={target} className="input" /><button className="btn-secondary">Scale</button></form>
            <div className="text-xs text-ink-2 mb-2">{meal.servings} servings → <b className="text-ink">{target}</b> servings (× {(scaled[0]?.factor ?? 1).toFixed(2)})</div>
            <table className="table"><tbody>{scaled.map((s) => { const ing = getIngredient(s.ingredient_id)!; return <tr key={s.ingredient_id}><td>{ing.name}</td><td className="text-right font-medium">{formatQty(s.quantity, ing.base_unit)}</td><td className="text-right text-xs text-ink-3">+{ing.waste_pct}% waste → {formatQty(s.quantity * (1 + ing.waste_pct / 100), ing.base_unit)}</td></tr>; })}</tbody></table>
            <div className="text-sm mt-3">Ingredient cost for {target}: <b>{formatZar(cost.ingredients * target)}</b></div>
          </Card>
          {can(user, "meals:edit") && (
            <Card title="Edit recipe" className="lg:col-span-3">
              <form action={saveRecipe} className="space-y-3">
                <input type="hidden" name="meal_id" value={meal.id} />
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {Array.from({ length: Math.max(12, lines.length + 3) }).map((_, k) => { const l = lines[k]; return (
                    <div key={k} className="flex gap-1">
                      <select name={`ing_${k}`} defaultValue={l?.ingredient_id ?? ""} className="input"><option value="">— ingredient —</option>{listIngredients().map((i) => <option key={i.id} value={i.id}>{i.name} ({i.base_unit})</option>)}</select>
                      <input name={`qty_${k}`} type="number" step="0.1" defaultValue={l?.quantity ?? ""} placeholder="qty" className="input !w-24" />
                      <input name={`note_${k}`} defaultValue={l?.note ?? ""} placeholder="note" className="input !w-28" />
                    </div>); })}
                </div>
                <Field label="Method (one step per line)"><textarea name="steps" rows={6} defaultValue={steps.map((s) => s.text).join("\n")} className="input" /></Field>
                <Field label="Portion note"><input name="portion_note" defaultValue={full.portion_note} className="input" /></Field>
                <button className="btn-primary btn-sm">Save recipe</button>
              </form>
            </Card>
          )}
        </div>
      )}

      {tab === "edit" && (can(user, "meals:edit") ? <Card title="Edit meal"><MealForm meal={meal} action={saveMeal} /></Card> : <Card><StatusBadge status="forbidden" /></Card>)}
    </div>
  );
}
