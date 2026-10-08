import { requireClient } from "@/lib/auth";
import { listPlans, getPlanFull } from "@/lib/repo/orders";
import { Card, StatusBadge, fmtDate, Empty, CategoryDot } from "@/components/ui";
import { DAY_NAMES } from "@/lib/types";
import { setPlanStatusAction } from "@/app/actions";

export default async function Plan({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireClient();
  const { id } = await searchParams;
  const plans = listPlans(user.client_id).filter((p) => p.status !== "draft");
  const sel = id ? plans.find((p) => p.id === Number(id)) : plans[0];
  const full = sel ? getPlanFull(sel.id) : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-end gap-2"><h1 className="text-3xl">My meal plan</h1><div className="flex gap-1 flex-wrap">{plans.slice(0, 6).map((p) => <a key={p.id} href={`/portal/plan?id=${p.id}`} className={`badge ${sel?.id === p.id ? "bg-ink text-white" : "bg-bone-2 text-ink-2"}`}>{fmtDate(p.week_start)}</a>)}</div></div>
      {!full ? <Card><Empty>No plan has been shared with you yet.</Empty></Card> : (<>
        <Card kicker={`Week of ${fmtDate(full.plan.week_start)}`} title={<span>Status: <StatusBadge status={full.plan.status} /></span>} action={full.plan.status === "proposed" ? <form action={setPlanStatusAction}><input type="hidden" name="plan_id" value={full.plan.id} /><input type="hidden" name="status" value="approved" /><button className="btn-primary">Approve this plan</button></form> : undefined}>
          <div className="text-sm text-ink-2">Average {full.totals.avg.kcal} kcal · {full.totals.avg.protein} g protein · {full.totals.avg.carbs} g carbs · {full.totals.avg.fat} g fat · {full.totals.avg.fibre} g fibre per day.{full.plan.notes && <> Planner note: {full.plan.notes}</>}</div>
        </Card>
        {DAY_NAMES.map((day, d) => { const items = full.items.filter((i) => i.day_index === d); const a = full.audits[d]; return items.length === 0 ? null : (
          <Card key={day} title={day} kicker={`${a.totals.kcal} kcal · ${a.totals.protein} g P · ${a.totals.carbs} g C · ${a.totals.fat} g F · ${a.totals.fibre} g fibre`}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{items.map((i) => <div key={i.id} className="rounded-xl border border-line p-3"><div className="kicker capitalize"><CategoryDot category={i.slot} /> {i.slot}</div><div className="font-medium text-sm">{i.meal.name}</div><div className="text-[11px] text-ink-2">{i.meal.nutrition.kcal} kcal · {i.meal.nutrition.protein} g P · {i.meal.nutrition.carbs} g C · {i.meal.nutrition.fat} g F</div><details className="text-[11px] text-ink-2 mt-1"><summary className="cursor-pointer">Why this meal</summary><ul className="list-disc pl-4">{i.reasons.map((r) => <li key={r}>{r}</li>)}</ul></details></div>)}</div>
          </Card>); })}
      </>)}
    </div>
  );
}
