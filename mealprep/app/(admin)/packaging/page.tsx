import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listOrders } from "@/lib/repo/orders";
import { PageHeader, Card, StatusBadge, fmtDate, Empty } from "@/components/ui";
import { getDb } from "@/lib/db";
import { BRAND_IDENTITY } from "@/lib/business";

export default async function Packaging() {
  await requirePermission("labels:view");
  const rows = listOrders().filter((o) => ["preparing", "packaging", "ready", "out_for_delivery"].includes(o.status) || (o.status === "delivered" && o.delivery_date >= new Date().toISOString().slice(0, 10)));
  const printed = new Map((getDb().prepare("SELECT oi.order_id, COUNT(l.id) AS n, SUM(l.printed_at IS NOT NULL) AS p FROM order_items oi LEFT JOIN meal_labels l ON l.order_item_id = oi.id GROUP BY oi.order_id").all() as { order_id: number; n: number; p: number }[]).map((r) => [r.order_id, r]));
  return (
    <div>
      <PageHeader kicker="Packaging" title="Labels & packaging">Each meal gets a wrap-around label with client name, meal number, nutrition, allergens, storage, reheating and a QR code to the client’s digital meal page.</PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Orders to pack" className="lg:col-span-2">
          {rows.length === 0 ? <Empty>No orders in packaging stages.</Empty> : <table className="table"><thead><tr><th>Order</th><th>Client</th><th>Delivery</th><th>Meals</th><th>Status</th><th>Labels</th><th></th></tr></thead><tbody>{rows.map((o) => { const p = printed.get(o.id); return <tr key={o.id}><td>{o.order_number}</td><td className="font-medium">{o.client_name}</td><td>{fmtDate(o.delivery_date)}</td><td>{o.meals}</td><td><StatusBadge status={o.status} /></td><td className="text-xs">{p ? `${p.p}/${p.n} printed` : "—"}</td><td><Link href={`/packaging/${o.id}`} className="btn-primary btn-sm">Labels</Link></td></tr>; })}</tbody></table>}
        </Card>
        <Card title="Packaging standard" kicker="Premium identity">
          <p className="text-sm text-ink-2">{BRAND_IDENTITY.packaging}</p>
          <ul className="text-xs text-ink-2 mt-3 space-y-1"><li><b>Front:</b> brand, client name, meal name, “Meal 03 of 14”, category band.</li><li><b>Back:</b> nutrition table, ingredients, allergens in bold, storage, reheating, QR.</li><li><b>Colour coding:</b> ochre breakfast · olive lunch · plum dinner · clay snack.</li></ul>
          <div className="flex gap-2 mt-3">{[["breakfast", "#d9a441"], ["lunch", "#6f7f3f"], ["dinner", "#5a3e5c"], ["snack", "#c98e7b"]].map(([n, c]) => <span key={n} className="badge text-white" style={{ background: c }}>{n}</span>)}</div>
        </Card>
      </div>
    </div>
  );
}
