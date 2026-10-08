import { requireClient } from "@/lib/auth";
import { listPlans, groceryForPlan } from "@/lib/repo/orders";
import { Card, Empty, fmtDate } from "@/components/ui";
import { groupByCategory, formatQty } from "@/lib/grocery";
import { INGREDIENT_CATEGORY_LABELS } from "@/lib/types";

export default async function Grocery() {
  const user = await requireClient();
  const plan = listPlans(user.client_id).filter((p) => p.status !== "draft")[0];
  const lines = plan ? groceryForPlan(plan.id) : [];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">My grocery list</h1>
      <p className="text-sm text-ink-2">Everything in your current plan, as ingredients — handy if you prefer to cook a week yourself or want to know exactly what goes into your meals.</p>
      {!plan ? <Card><Empty>No plan yet.</Empty></Card> : <Card title={`Week of ${fmtDate(plan.week_start)}`}>{groupByCategory(lines).map((g) => <div key={g.category} className="mb-3"><div className="kicker mb-1">{INGREDIENT_CATEGORY_LABELS[g.category]}</div><ul className="text-sm grid sm:grid-cols-2 gap-x-6">{g.lines.map((l) => <li key={l.ingredient_id} className="flex justify-between border-b border-line/60 py-1"><span>{l.name}</span><span className="text-ink-2">{formatQty(l.required, l.unit)}</span></li>)}</ul></div>)}</Card>}
    </div>
  );
}
