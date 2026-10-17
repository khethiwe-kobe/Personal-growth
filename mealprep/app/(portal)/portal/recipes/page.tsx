import { requireClient } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getMealFull } from "@/lib/repo/meals";
import { Card, Empty, CategoryBadge } from "@/components/ui";
import { ALLERGEN_LABELS } from "@/lib/types";
import { formatQty } from "@/lib/grocery";

export default async function Recipes({ searchParams }: { searchParams: Promise<{ meal?: string }> }) {
  const user = await requireClient();
  const { meal } = await searchParams;
  const mine = getDb().prepare("SELECT DISTINCT oi.meal_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.client_id = ? UNION SELECT DISTINCT i.meal_id FROM meal_plan_items i JOIN meal_plans p ON p.id = i.plan_id WHERE p.client_id = ?").all(user.client_id, user.client_id) as { meal_id: number }[];
  const meals = mine.map((m) => getMealFull(m.meal_id)).filter(Boolean) as NonNullable<ReturnType<typeof getMealFull>>[];
  const sel = meal ? meals.find((m) => m.meal.id === Number(meal)) : meals[0];
  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-4">
      <div><h1 className="text-3xl mb-3">My recipes</h1><ul className="space-y-1">{meals.map((m) => <li key={m.meal.id}><a href={`/portal/recipes?meal=${m.meal.id}`} className={`block rounded-lg px-3 py-1.5 text-sm ${sel?.meal.id === m.meal.id ? "bg-ink text-white" : "hover:bg-bone-2"}`}>{m.meal.name}</a></li>)}</ul></div>
      {!sel ? <Card><Empty>No recipes yet.</Empty></Card> : <Card title={sel.meal.name} kicker={<CategoryBadge category={sel.meal.category} />}>
        <p className="text-sm text-ink-2">{sel.meal.description}</p>
        <div className="grid sm:grid-cols-2 gap-4 mt-4"><div><div className="kicker mb-1">Ingredients (per portion)</div><ul className="text-sm">{sel.lines.map((l) => <li key={l.id} className="flex justify-between border-b border-line/60 py-1"><span>{l.ingredient.name}</span><span className="text-ink-2">{formatQty(l.quantity / sel.meal.servings, l.ingredient.base_unit)}</span></li>)}</ul><div className="text-xs mt-2"><b>Allergens:</b> {sel.allergens.length ? sel.allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(", ") : "none declared"}</div></div><div><div className="kicker mb-1">Method</div><ol className="text-sm list-decimal pl-5 space-y-1">{sel.steps.map((s, i) => <li key={i}>{s.text}</li>)}</ol><div className="kicker mt-3 mb-1">Reheating</div><p className="text-sm">{sel.meal.reheating}</p><div className="kicker mt-3 mb-1">Per portion</div><p className="text-sm">{sel.nutrition.kcal} kcal · {sel.nutrition.protein} g protein · {sel.nutrition.carbs} g carbs · {sel.nutrition.fat} g fat · {sel.nutrition.fibre} g fibre</p></div></div>
      </Card>}
    </div>
  );
}
