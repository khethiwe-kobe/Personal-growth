import Link from "next/link";
import { requirePermission, can } from "@/lib/auth";
import { productionSummary, batchIngredients, kitchenStaff, batchesBetween } from "@/lib/repo/production";
import { PageHeader, Card, StatusBadge, CategoryDot, Field, Empty, Stat } from "@/components/ui";
import { PRODUCTION_STATUSES } from "@/lib/types";
import { setBatchStatusAction } from "@/app/actions";
import { todayIso, shiftDays } from "@/lib/finance";
import { formatQty } from "@/lib/grocery";
import { getSettingNumber } from "@/lib/db";

export default async function Production({ searchParams }: { searchParams: Promise<{ date?: string; batch?: string }> }) {
  const user = await requirePermission("production:view");
  const sp = await searchParams;
  const date = sp.date ?? todayIso();
  const s = productionSummary(date);
  const staff = kitchenStaff();
  const edit = can(user, "production:edit");
  const open = sp.batch ? s.batches.find((b) => b.id === Number(sp.batch)) : null;
  const ingredients = open ? batchIngredients(open.id) : [];
  const week = batchesBetween(shiftDays(date, -1), shiftDays(date, 6));
  const capacity = getSettingNumber("kitchen_capacity_meals_per_day");
  const cols = PRODUCTION_STATUSES.filter((st) => st !== "delivered");
  return (
    <div>
      <PageHeader kicker="Kitchen" title={`Production · ${date}`} actions={<><Link href={`/production?date=${shiftDays(date, -1)}`} className="btn-secondary btn-sm">← Prev</Link><Link href={`/production?date=${todayIso()}`} className="btn-secondary btn-sm">Today</Link><Link href={`/production?date=${shiftDays(date, 1)}`} className="btn-secondary btn-sm">Next →</Link><Link href={`/api/export/production?date=${date}`} className="btn-secondary btn-sm">CSV</Link></>}>Batches are grouped per meal across all paid orders delivering the next day. Moving a batch to Cooking consumes ingredients FIFO; Ready generates labels.</PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"><Stat label="Meals required" value={s.required} sub={`capacity ${capacity}/day`} tone={s.required > capacity ? "critical" : "neutral"} /><Stat label="In progress" value={s.in_progress} /><Stat label="Ready" value={s.ready} tone="good" /><Stat label="Remaining" value={s.remaining} tone={s.remaining ? "warn" : "good"} /><Stat label="Batches" value={s.batches.length} sub={`${s.batches.filter((b) => b.assigned_name).length} assigned`} /></div>
      {s.batches.length === 0 ? <Card><Empty>Nothing scheduled for {date}. Upcoming: {week.filter((b) => b.production_date > date).slice(0, 5).map((b) => <Link key={b.id} href={`/production?date=${b.production_date}`} className="text-accent ml-1">{b.production_date}</Link>)}</Empty></Card> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-7 gap-2 overflow-x-auto mb-4">
          {cols.map((st) => { const items = s.batches.filter((b) => b.status === st); return (
            <div key={st} className="card p-2.5 min-h-[160px]">
              <div className="flex justify-between items-center mb-2"><div className="kicker">{st.replace(/_/g, " ")}</div><span className="badge bg-bone-2 text-ink-2">{items.reduce((t, b) => t + b.quantity_required, 0)}</span></div>
              <div className="space-y-2">{items.map((b) => (
                <div key={b.id} className={`rounded-lg border p-2 ${open?.id === b.id ? "border-accent" : "border-line"}`}>
                  <Link href={`/production?date=${date}&batch=${b.id}`} className="text-xs font-medium hover:underline"><CategoryDot category={b.category} /> {b.meal_name}</Link>
                  <div className="text-[11px] text-ink-2">{b.quantity_required} meals · {b.orders} orders{b.assigned_name ? ` · ${b.assigned_name}` : ""}</div>
                  {edit && st !== "ready" && <form action={setBatchStatusAction} className="mt-1"><input type="hidden" name="batch_id" value={b.id} /><input type="hidden" name="status" value={PRODUCTION_STATUSES[PRODUCTION_STATUSES.indexOf(st) + 1]} /><button className="btn-secondary btn-sm w-full">→ {PRODUCTION_STATUSES[PRODUCTION_STATUSES.indexOf(st) + 1].replace(/_/g, " ")}</button></form>}
                </div>))}</div>
            </div>); })}
        </div>
      )}
      {open && (
        <Card title={`${open.meal_name} · ${open.quantity_required} meals`} kicker={`Batch #${open.id} · ${open.status.replace(/_/g, " ")} · clients: ${open.clients}`} action={<Link href={`/meals/${open.meal_id}?tab=recipe&servings=${open.quantity_required}`} className="btn-secondary btn-sm">Scaled recipe</Link>}>
          <div className="grid lg:grid-cols-2 gap-4">
            <div><div className="kicker mb-1">Ingredients required</div><table className="table"><thead><tr><th>Ingredient</th><th>Required</th><th>In stock</th></tr></thead><tbody>{ingredients.map((i) => <tr key={i.ingredient_id}><td>{i.name}</td><td>{formatQty(i.required, i.base_unit)}</td><td className={i.stock < i.required ? "text-critical" : "text-good"}>{formatQty(i.stock, i.base_unit)}</td></tr>)}</tbody></table></div>
            {edit && <form action={setBatchStatusAction} className="grid grid-cols-2 gap-2 content-start"><input type="hidden" name="batch_id" value={open.id} /><Field label="Status"><select name="status" defaultValue={open.status} className="input">{PRODUCTION_STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, " ")}</option>)}</select></Field><Field label="Assigned to"><select name="assigned_user_id" defaultValue={open.assigned_user_id ?? ""} className="input"><option value="">—</option>{staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="Quantity done"><input name="quantity_done" type="number" defaultValue={open.quantity_done} className="input" /></Field><Field label="Quantity wasted"><input name="quantity_wasted" type="number" defaultValue={open.quantity_wasted} className="input" /></Field><Field label="QC notes" className="col-span-2"><textarea name="qc_notes" rows={2} defaultValue={open.qc_notes} className="input" /></Field><div><button className="btn-primary btn-sm">Update batch</button></div></form>}
          </div>
        </Card>
      )}
      <Card title="Next 7 days" kicker="Capacity planning" className="mt-4">
        <table className="table"><thead><tr><th>Date</th><th>Batches</th><th>Meals</th><th>Capacity</th><th>Status</th></tr></thead><tbody>{Array.from({ length: 7 }).map((_, k) => { const d = shiftDays(date, k); const bs = week.filter((b) => b.production_date === d); const meals = bs.reduce((t, b) => t + b.quantity_required, 0); return <tr key={d}><td><Link href={`/production?date=${d}`} className="hover:underline">{d}</Link></td><td>{bs.length}</td><td>{meals}</td><td>{Math.round((meals / capacity) * 100)}%</td><td>{meals > capacity ? <StatusBadge status="failed" /> : bs.every((b) => ["ready", "delivered"].includes(b.status)) && bs.length ? <StatusBadge status="ready" /> : <StatusBadge status={bs.length ? "preparing" : "not_started"} />}</td></tr>; })}</tbody></table>
      </Card>
    </div>
  );
}
