import { requireClient } from "@/lib/auth";
import { listOrders, getOrder } from "@/lib/repo/orders";
import { getMealFull } from "@/lib/repo/meals";
import { Card, StatusBadge, fmtDate, Empty, CategoryDot, NutritionRow } from "@/components/ui";
import Link from "next/link";

export default async function Meals() {
  const user = await requireClient();
  const orders = listOrders({ clientId: user.client_id }).filter((o) => !["cancelled", "inquiry"].includes(o.status)).slice(0, 3);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">My meals</h1>
      {orders.length === 0 ? <Card><Empty>No meals yet.</Empty></Card> : orders.map((o) => { const f = getOrder(o.id)!; return (
        <Card key={o.id} title={`Delivery ${fmtDate(o.delivery_date)}`} kicker={o.order_number} action={<StatusBadge status={o.status} />}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{f.items.map((i) => { const m = getMealFull(i.meal_id)!; return <div key={i.id} className="rounded-xl border border-line p-3"><div className="kicker"><CategoryDot category={i.category} /> Meal {String(i.meal_number).padStart(2, "0")} of {f.items.length}</div><Link href={`/portal/recipes?meal=${i.meal_id}`} className="font-medium text-sm hover:underline">{i.meal_name}</Link><div className="mt-1"><NutritionRow n={m.nutrition} compact /></div><div className="text-[11px] text-ink-3 mt-1">{m.meal.reheating}</div><div className="mt-1"><StatusBadge status={i.status} /></div></div>; })}</div>
        </Card>); })}
    </div>
  );
}
