import { requirePermission, can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, Stat, Field } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { saveStartupCostAction } from "@/app/actions";

export default async function StartupCosts() {
  const user = await requirePermission("business:view");
  const rows = getDb().prepare("SELECT * FROM startup_cost_items ORDER BY sort_order, id").all() as { id: number; category: string; description: string; estimate_zar: number; actual_zar: number | null; is_recurring: number }[];
  const est = rows.reduce((s, r) => s + r.estimate_zar, 0);
  const act = rows.reduce((s, r) => s + (r.actual_zar ?? r.estimate_zar), 0);
  const recurring = rows.filter((r) => r.is_recurring).reduce((s, r) => s + (r.actual_zar ?? r.estimate_zar), 0);
  return (
    <div>
      <PageHeader kicker="Planning" title="Startup cost planner">Estimates are placeholders — enter actual quotes as you receive them. Recurring items feed your monthly fixed-cost estimate for the break-even calculator.</PageHeader>
      <div className="grid grid-cols-3 gap-3 mb-5"><Stat label="Estimated total" value={formatZar(est)} /><Stat label="Projected (actuals where known)" value={formatZar(act)} tone={act > est ? "warn" : "good"} /><Stat label="Monthly recurring" value={formatZar(recurring)} sub="→ break-even fixed costs" /></div>
      <Card>
        <form action={saveStartupCostAction}>
          <table className="table"><thead><tr><th>Category</th><th>Description</th><th>Estimate (R)</th><th>Actual (R)</th><th>Recurring</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td className="font-medium">{r.category}</td><td className="text-xs text-ink-2">{r.description}</td><td><input name={`estimate_${r.id}`} type="number" defaultValue={r.estimate_zar} className="input !w-32" /></td><td><input name={`actual_${r.id}`} type="number" defaultValue={r.actual_zar ?? ""} placeholder="—" className="input !w-32" /></td><td className="text-xs">{r.is_recurring ? "monthly" : ""}</td></tr>)}</tbody></table>
          {can(user, "business:edit") && <><div className="grid sm:grid-cols-4 gap-2 mt-4 items-end"><Field label="New category"><input name="new_category" className="input" /></Field><Field label="Description"><input name="new_description" className="input" /></Field><Field label="Estimate (R)"><input name="new_estimate" type="number" className="input" /></Field><button className="btn-primary">Save all</button></div></>}
        </form>
      </Card>
    </div>
  );
}
