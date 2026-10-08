import Link from "next/link";
import { requirePermission, can } from "@/lib/auth";
import { groceryForOrders } from "@/lib/repo/orders";
import { listSuppliers, compareSuppliers } from "@/lib/repo/inventory";
import { PageHeader, Card, Field, Empty } from "@/components/ui";
import { groupByCategory, formatQty, type GroceryLine } from "@/lib/grocery";
import { INGREDIENT_CATEGORY_LABELS } from "@/lib/types";
import { formatZar } from "@/lib/costing";
import { startOfWeek, shiftDays } from "@/lib/finance";
import { createPurchaseOrderAction } from "@/app/actions";
import { mondayOf } from "@/lib/repo/orders";
import { todayIso } from "@/lib/finance";

export default async function Grocery({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; scope?: string }> }) {
  const user = await requirePermission("inventory:view");
  const sp = await searchParams;
  const from = sp.from ?? mondayOf(shiftDays(todayIso(), 7));
  const to = sp.to ?? shiftDays(from, 6);
  const scope = sp.scope ?? "committed";
  const statuses = scope === "all" ? ["awaiting_payment", "paid", "plan_created", "shopping", "preparing"] : ["paid", "plan_created", "shopping", "preparing"];
  const g = groceryForOrders({ from, to, statuses });
  const groups = groupByCategory(g.lines);
  const toBuy = g.lines.filter((l) => l.to_purchase > 0);
  const suppliers = listSuppliers().filter((s) => s.is_active);
  const bySupplier = new Map<number, { name: string; lines: GroceryLine[]; options: Map<number, number> }>();
  for (const l of toBuy) {
    const opts = compareSuppliers(l.ingredient_id);
    const rec = opts.find((o) => o.recommended) ?? opts[0];
    if (!rec) continue;
    const cur = bySupplier.get(rec.supplier_id) ?? { name: rec.supplier, lines: [] as GroceryLine[], options: new Map<number, number>() };
    cur.lines.push(l); cur.options.set(l.ingredient_id, rec.price_per_unit);
    bySupplier.set(rec.supplier_id, cur);
  }
  return (
    <div>
      <PageHeader kicker="Purchasing" title="Master grocery list" actions={<Link href={`/api/export/grocery?from=${from}&to=${to}`} className="btn-secondary btn-sm">CSV</Link>}>Every order in the window, converted through recipes to ingredient quantities, with waste allowance, netted against stock on hand.</PageHeader>
      <Card className="mb-4">
        <form className="flex flex-wrap items-end gap-2">
          <Field label="Deliveries from"><input name="from" type="date" defaultValue={from} className="input" /></Field>
          <Field label="to"><input name="to" type="date" defaultValue={to} className="input" /></Field>
          <Field label="Orders"><select name="scope" defaultValue={scope} className="input"><option value="committed">Paid only</option><option value="all">Include awaiting payment</option></select></Field>
          <button className="btn-secondary">Update</button>
          <div className="text-sm text-ink-2 ml-auto">{g.orders} orders · {g.meals} meals · {toBuy.length} ingredients to buy · est. {formatZar(toBuy.reduce((s, l) => s + (l.est_cost ?? 0), 0))}</div>
        </form>
        <div className="flex gap-2 mt-3 text-xs">{[["This week", startOfWeek(), shiftDays(startOfWeek(), 6)], ["Next week", mondayOf(shiftDays(todayIso(), 7)), shiftDays(mondayOf(shiftDays(todayIso(), 7)), 6)], ["Next 14 days", todayIso(), shiftDays(todayIso(), 14)]].map(([l, f, t]) => <Link key={l} href={`/grocery?from=${f}&to=${t}&scope=${scope}`} className="badge bg-bone-2 text-ink-2 hover:bg-bone">{l}</Link>)}</div>
      </Card>
      {g.lines.length === 0 ? <Card><Empty>No orders in this window. Approve plans and record payments to populate the list.</Empty></Card> : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {groups.map((grp) => (
              <Card key={grp.category} title={INGREDIENT_CATEGORY_LABELS[grp.category]} kicker={`${grp.lines.length} items · est. ${formatZar(grp.est_cost)} to buy`}>
                <table className="table"><thead><tr><th>Ingredient</th><th>Required</th><th>+ waste</th><th>In stock</th><th>Purchase</th><th>Est. cost</th><th>Supplier</th><th>Used in</th></tr></thead><tbody>{grp.lines.map((l) => <tr key={l.ingredient_id}><td className="font-medium">{l.name}</td><td>{formatQty(l.required, l.unit)}</td><td>{formatQty(l.with_waste, l.unit)}</td><td className="text-ink-2">{formatQty(l.stock, l.unit)}</td><td className={l.to_purchase > 0 ? "font-semibold text-accent" : "text-ink-3"}>{formatQty(l.to_purchase, l.unit)}</td><td>{l.est_cost == null ? "—" : formatZar(l.est_cost)}</td><td className="text-xs text-ink-2">{l.supplier ?? "—"}</td><td className="text-[11px] text-ink-3">{l.meals.join(", ")}</td></tr>)}</tbody></table>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <Card title="Purchase orders by recommended supplier" kicker="Price + reliability + quality">
              {bySupplier.size === 0 ? <Empty>Stock covers every requirement.</Empty> : [...bySupplier.entries()].map(([sid, s]) => (
                <form key={sid} action={createPurchaseOrderAction} className="mb-4 rounded-xl border border-line p-3">
                  <input type="hidden" name="supplier_id" value={sid} />
                  <div className="font-medium text-sm mb-1">{s.name}</div>
                  <table className="table"><tbody>{s.lines.map((l) => <tr key={l.ingredient_id}><td className="text-xs">{l.name}</td><td><input name={`qty_${l.ingredient_id}`} type="number" step="1" defaultValue={Math.ceil(l.to_purchase)} className="input !py-0.5 !text-xs !w-24" /><input type="hidden" name={`price_${l.ingredient_id}`} value={s.options.get(l.ingredient_id) ?? 0} /></td><td className="text-xs text-ink-2">{l.unit}</td><td className="text-xs">{formatZar(l.to_purchase * (s.options.get(l.ingredient_id) ?? 0))}</td></tr>)}</tbody></table>
                  {can(user, "inventory:edit") && <button className="btn-primary btn-sm mt-2">Create PO ({formatZar(s.lines.reduce((t, l) => t + l.to_purchase * (s.options.get(l.ingredient_id) ?? 0), 0))})</button>}
                </form>
              ))}
              <div className="text-xs text-ink-3">{suppliers.length} active suppliers. Change recommendation weights in Settings.</div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
