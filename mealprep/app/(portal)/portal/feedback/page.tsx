import { requireClient } from "@/lib/auth";
import { listOrders, getOrder } from "@/lib/repo/orders";
import { getDb } from "@/lib/db";
import { Card, Field, fmtDate, Empty, Rating } from "@/components/ui";
import { addFeedbackAction } from "@/app/actions";

const R = ({ name, label }: { name: string; label: string }) => <Field label={label}><select name={name} className="input" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 5 ? "— excellent" : n === 1 ? "— poor" : ""}</option>)}</select></Field>;

export default async function Feedback({ searchParams }: { searchParams: Promise<{ order?: string; meal?: string }> }) {
  const user = await requireClient();
  const sp = await searchParams;
  const delivered = listOrders({ clientId: user.client_id }).filter((o) => ["delivered", "completed"].includes(o.status)).slice(0, 5);
  const orderId = sp.order ? Number(sp.order) : delivered[0]?.id;
  const order = orderId ? getOrder(orderId) : null;
  const mine = getDb().prepare("SELECT f.*, m.name AS meal_name FROM feedback f LEFT JOIN meals m ON m.id = f.meal_id WHERE f.client_id = ? ORDER BY f.created_at DESC LIMIT 20").all(user.client_id) as { id: number; overall: number | null; comment: string; meal_name: string | null; created_at: string }[];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">My feedback</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Rate a delivery" kicker={order ? `${order.order.order_number} · ${fmtDate(order.order.delivery_date)}` : undefined}>
          {!order || !order.client || order.client.id !== user.client_id ? <Empty>No delivered orders to rate yet.</Empty> : (
            <form action={addFeedbackAction} className="grid grid-cols-2 gap-2">
              <input type="hidden" name="order_id" value={order.order.id} />
              <Field label="Meal (optional)" className="col-span-2"><select name="meal_id" defaultValue={sp.meal ?? ""} className="input"><option value="">Whole delivery</option>{order.items.map((i) => <option key={i.id} value={i.meal_id}>{i.meal_name}</option>)}</select></Field>
              <R name="taste" label="Taste" /><R name="portion" label="Portion size" /><R name="presentation" label="Presentation" /><R name="variety" label="Variety" /><R name="packaging" label="Packaging" /><R name="overall" label="Overall satisfaction" />
              <Field label="Comments" className="col-span-2"><textarea name="comment" rows={3} className="input" /></Field>
              <div><button className="btn-primary">Send feedback</button></div>
            </form>
          )}
          {delivered.length > 1 && <div className="flex gap-1 flex-wrap mt-3 text-xs">{delivered.map((o) => <a key={o.id} href={`/portal/feedback?order=${o.id}`} className={`badge ${o.id === orderId ? "bg-ink text-white" : "bg-bone-2 text-ink-2"}`}>{fmtDate(o.delivery_date)}</a>)}</div>}
        </Card>
        <Card title="What you&apos;ve said">{mine.length === 0 ? <Empty>Nothing yet.</Empty> : <ul className="divide-y divide-line text-sm">{mine.map((f) => <li key={f.id} className="py-2"><Rating value={f.overall} /> <b>{f.meal_name ?? "Delivery"}</b> <span className="text-ink-2">{f.comment}</span><div className="text-[11px] text-ink-3">{fmtDate(f.created_at)}</div></li>)}</ul>}</Card>
      </div>
    </div>
  );
}
