import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/auth";
import { getPlanFull, groceryForPlan, listPackages, listSubscriptions } from "@/lib/repo/orders";
import { mealProfiles } from "@/lib/repo/meals";
import { PageHeader, Card, StatusBadge, Disclaimer, Field, fmtDate, CategoryDot, Empty } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { DAY_NAMES } from "@/lib/types";
import { formatZar } from "@/lib/costing";
import { formatQty, groupByCategory } from "@/lib/grocery";
import { INGREDIENT_CATEGORY_LABELS } from "@/lib/types";
import { setPlanItemAction, setPlanStatusAction, createOrderAction } from "@/app/actions";
import { shiftDays } from "@/lib/finance";
import PrintButton from "@/components/PrintButton";

export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("plans:view");
  const { id } = await params;
  const { tab = "plan" } = await searchParams;
  const full = getPlanFull(Number(id));
  if (!full) notFound();
  const { plan, items, audits, totals, suggestions, slots, client, targets } = full;
  const editable = can(user, "plans:edit") && ["draft", "proposed", "approved"].includes(plan.status);
  const meals = mealProfiles(plan.client_id);
  const grocery = groceryForPlan(plan.id);
  const subs = listSubscriptions(plan.client_id).filter((s) => s.status === "active");

  return (
    <div>
      <PageHeader kicker={<span>Plan #{plan.id} · <StatusBadge status={plan.status} /></span>} title={`${client.name} · week of ${fmtDate(plan.week_start)}`} actions={<>
        <Link href={`/clients/${plan.client_id}`} className="btn-secondary btn-sm">Client</Link>
        <Link href={`/api/export/plan/${plan.id}`} className="btn-secondary btn-sm">Export CSV</Link>
        <a href={`/meal-plans/${plan.id}?tab=print`} className="btn-secondary btn-sm">Printable</a>
        {can(user, "plans:edit") && plan.status === "draft" && <form action={setPlanStatusAction}><input type="hidden" name="plan_id" value={plan.id} /><input type="hidden" name="status" value="proposed" /><button className="btn-primary btn-sm">Propose to client</button></form>}
        {can(user, "plans:edit") && plan.status === "proposed" && <form action={setPlanStatusAction}><input type="hidden" name="plan_id" value={plan.id} /><input type="hidden" name="status" value="approved" /><button className="btn-primary btn-sm">Mark approved (on client’s behalf)</button></form>}
      </>}>
        {items.length} meals · avg {totals.avg.kcal} kcal/day · plan price {formatZar(totals.price)} · cost {formatZar(totals.cost)} · targets {targets.calories_min ?? "—"}–{targets.calories_max ?? "—"} kcal, {targets.protein_g ?? "—"} g protein
      </PageHeader>
      {targets.requires_professional_review && <Disclaimer text="This client is flagged for professional review. The plan is preliminary and must not be presented as personalised advice until signed off." />}

      <nav className="flex gap-1 border-b border-line my-4">{[["plan", "Weekly plan"], ["nutrition", "Nutrition audit"], ["grocery", "Grocery list"], ["order", "Create order"]].map(([k, l]) => <Link key={k} href={`/meal-plans/${plan.id}?tab=${k}`} className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === k ? "border-accent font-medium" : "border-transparent text-ink-2"}`}>{l}</Link>)}</nav>

      {(tab === "plan" || tab === "print") && (
        <div className="space-y-3">
          {tab === "print" && <div className="no-print"><PrintButton /></div>}
          {DAY_NAMES.map((day, d) => {
            const audit = audits[d];
            return (
              <Card key={day} title={day} kicker={`${audit.totals.kcal} kcal · ${audit.totals.protein} g P · ${audit.totals.carbs} g C · ${audit.totals.fat} g F · ${audit.totals.fibre} g fibre`} action={audit.gaps.length ? <span className="badge bg-amber-100 text-amber-900">{audit.gaps.length} gap(s)</span> : <span className="badge bg-emerald-100 text-emerald-900">on target</span>}>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}>
                  {slots.map((slot) => {
                    const it = items.find((i) => i.day_index === d && i.slot === slot);
                    return (
                      <div key={slot} className="rounded-xl border border-line p-3 min-h-[96px]">
                        <div className="kicker capitalize mb-1"><CategoryDot category={slot} /> {slot}</div>
                        {it ? (<>
                          <Link href={`/meals/${it.meal_id}`} className="text-sm font-medium hover:underline">{it.meal.name}</Link>
                          <div className="text-[11px] text-ink-2 mt-0.5">{it.meal.nutrition.kcal} kcal · {it.meal.nutrition.protein} g P · {it.meal.nutrition.carbs} g C · {it.meal.nutrition.fat} g F · {it.meal.nutrition.fibre} g fibre{it.portion_multiplier !== 1 ? ` · ${it.portion_multiplier}× portion` : ""}</div>
                          <details className="text-[11px] text-ink-2 mt-1"><summary className="cursor-pointer">Why this meal</summary><ul className="list-disc pl-4 mt-1">{it.reasons.map((r) => <li key={r}>{r}</li>)}</ul></details>
                        </>) : <div className="text-xs text-ink-3">—</div>}
                        {editable && tab !== "print" && (
                          <form action={setPlanItemAction} className="flex gap-1 mt-2 no-print">
                            <input type="hidden" name="plan_id" value={plan.id} /><input type="hidden" name="day_index" value={d} /><input type="hidden" name="slot" value={slot} />
                            <select name="meal_id" defaultValue={it?.meal_id ?? ""} className="input !py-1 !text-xs"><option value="">— remove —</option>{meals.filter((m) => (slot === "snack" ? ["snack", "dessert", "drink"].includes(m.category) : m.category === slot)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                            <select name="portion" defaultValue={it?.portion_multiplier ?? 1} className="input !py-1 !text-xs !w-20">{[0.75, 1, 1.25, 1.5].map((p) => <option key={p} value={p}>{p}×</option>)}</select>
                            <button className="btn-secondary btn-sm">Set</button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
                {audit.gaps.length > 0 && <ul className="text-xs text-amber-900 mt-2 list-disc pl-4">{audit.gaps.map((g) => <li key={g}>{g}</li>)}</ul>}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "nutrition" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Daily energy vs target" className="lg:col-span-2"><BarChart labels={audits.map((a) => a.day.slice(0, 3))} series={[{ name: "kcal", values: audits.map((a) => a.totals.kcal) }, { name: "Target", values: audits.map(() => targets.calories_target ?? 0) }]} height={200} /></Card>
          <Card title="Weekly averages"><table className="table"><tbody><tr><td>Energy</td><td className="text-right">{totals.avg.kcal} kcal</td><td className="text-right text-xs text-ink-3">{targets.calories_min}–{targets.calories_max}</td></tr><tr><td>Protein</td><td className="text-right">{totals.avg.protein} g</td><td className="text-right text-xs text-ink-3">{targets.protein_g} g</td></tr><tr><td>Carbs</td><td className="text-right">{totals.avg.carbs} g</td><td className="text-right text-xs text-ink-3">{targets.carbs_min_g}–{targets.carbs_max_g} g</td></tr><tr><td>Fat</td><td className="text-right">{totals.avg.fat} g</td><td className="text-right text-xs text-ink-3">{targets.fat_min_g}–{targets.fat_max_g} g</td></tr><tr><td>Fibre</td><td className="text-right">{totals.avg.fibre} g</td><td className="text-right text-xs text-ink-3">{targets.fibre_g} g</td></tr><tr><td>Sodium</td><td className="text-right">{totals.avg.sodium_mg} mg</td><td className="text-right text-xs text-ink-3">&lt; 2300</td></tr></tbody></table></Card>
          <Card title="Protein & fibre by day" className="lg:col-span-2"><BarChart labels={audits.map((a) => a.day.slice(0, 3))} series={[{ name: "Protein g", values: audits.map((a) => a.totals.protein) }, { name: "Fibre g", values: audits.map((a) => a.totals.fibre) }]} height={180} /></Card>
          <Card title="Recommended adjustments">{suggestions.length === 0 ? <p className="text-sm text-ink-2">No adjustments needed — every day is within range.</p> : <ul className="text-sm space-y-2 list-disc pl-4">{suggestions.map((s) => <li key={s}>{s}</li>)}</ul>}<Disclaimer /></Card>
        </div>
      )}

      {tab === "grocery" && (
        <Card title="Grocery list for this plan" kicker="Scaled from recipes × portions × people served, with waste allowance">
          {groupByCategory(grocery).map((g) => <div key={g.category} className="mb-4"><div className="kicker mb-1">{INGREDIENT_CATEGORY_LABELS[g.category]}</div><table className="table"><thead><tr><th>Ingredient</th><th>Required</th><th>With waste</th><th>In stock</th><th>Buy</th><th>Est. cost</th></tr></thead><tbody>{g.lines.map((l) => <tr key={l.ingredient_id}><td>{l.name}</td><td>{formatQty(l.required, l.unit)}</td><td>{formatQty(l.with_waste, l.unit)}</td><td>{formatQty(l.stock, l.unit)}</td><td className={l.to_purchase > 0 ? "font-medium" : "text-ink-3"}>{formatQty(l.to_purchase, l.unit)}</td><td>{l.est_cost == null ? "—" : formatZar(l.est_cost)}</td></tr>)}</tbody></table></div>)}
        </Card>
      )}

      {tab === "order" && (
        <Card title="Create an order from this plan" kicker="One order item per meal slot; cost and price are snapshotted">
          {plan.status === "ordered" ? <Empty>This plan has already been ordered. <Link href={`/orders?q=${encodeURIComponent(client.name)}`} className="text-accent">View orders</Link></Empty> : !can(user, "orders:edit") ? <Empty>You do not have permission to create orders.</Empty> : (
            <form action={createOrderAction} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input type="hidden" name="plan_id" value={plan.id} />
              <Field label="Delivery date"><input name="delivery_date" type="date" defaultValue={shiftDays(plan.week_start, -1)} className="input" required /></Field>
              <Field label="Package (optional)"><select name="package_id" className="input"><option value="">None</option>{listPackages().map((p) => <option key={p.id} value={p.id}>{p.name} · {p.meals_per_week} meals</option>)}</select></Field>
              <Field label="Subscription (optional)"><select name="subscription_id" className="input"><option value="">None</option>{subs.map((s) => <option key={s.id} value={s.id}>#{s.id} {s.meals_per_week}/wk {s.frequency}</option>)}</select></Field>
              <Field label="Discount (R)"><input name="discount_zar" type="number" defaultValue={0} className="input" /></Field>
              <div className="sm:col-span-2 lg:col-span-4 text-sm text-ink-2">Plan price {formatZar(totals.price)} + delivery fee. {plan.status !== "approved" && <span className="text-amber-800">The plan is not yet approved by the client; you can still create the order (e.g. phone approval).</span>}</div>
              <div><button className="btn-primary">Create order</button></div>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
