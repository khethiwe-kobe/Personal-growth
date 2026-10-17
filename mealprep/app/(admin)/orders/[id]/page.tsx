import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/auth";
import { getOrder } from "@/lib/repo/orders";
import { PageHeader, Card, StatusBadge, fmtDate, Field, CategoryDot } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { ORDER_STATUSES, DAY_NAMES } from "@/lib/types";
import { setOrderStatusAction, recordPaymentAction, sendPaymentReminder } from "@/app/actions";
import { getSetting } from "@/lib/db";
import PrintButton from "@/components/PrintButton";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const user = await requirePermission("orders:view");
  const { id } = await params;
  const { view } = await searchParams;
  const o = getOrder(Number(id));
  if (!o) notFound();
  const cost = o.items.reduce((s, i) => s + i.unit_cost_zar * i.quantity, 0);
  const outstanding = Math.max(0, o.order.total_zar - o.paid);
  if (view === "invoice") return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-line">
      <div className="flex justify-between items-start"><div><div className="font-display text-2xl">{getSetting("brand_name")}</div><div className="text-xs text-ink-2">{getSetting("tagline")}</div></div><div className="text-right"><div className="kicker">Invoice</div><div className="font-medium">{o.order.order_number}</div><div className="text-xs text-ink-2">{fmtDate(o.order.created_at)}</div></div></div>
      <div className="mt-6 text-sm"><div className="kicker">Bill to</div><div>{o.client.name}</div><div className="text-ink-2">{o.client.email} · {o.client.phone}</div><div className="text-ink-2">{o.order.delivery_address}</div></div>
      <table className="table mt-6"><thead><tr><th>#</th><th>Meal</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>{o.items.map((i) => <tr key={i.id}><td>{i.meal_number}</td><td>{i.meal_name}</td><td>{i.quantity}</td><td>{formatZar(i.unit_price_zar)}</td><td>{formatZar(i.unit_price_zar * i.quantity)}</td></tr>)}</tbody></table>
      <div className="mt-4 text-sm ml-auto w-64 space-y-1"><div className="flex justify-between"><span>Subtotal</span><span>{formatZar(o.order.subtotal_zar)}</span></div><div className="flex justify-between"><span>Discount</span><span>−{formatZar(o.order.discount_zar)}</span></div><div className="flex justify-between"><span>Delivery</span><span>{formatZar(o.order.delivery_fee_zar)}</span></div><div className="flex justify-between font-medium border-t border-line pt-1"><span>Total</span><span>{formatZar(o.order.total_zar)}</span></div><div className="flex justify-between text-ink-2"><span>Paid</span><span>{formatZar(o.paid)}</span></div><div className="flex justify-between font-medium"><span>Balance due</span><span>{formatZar(outstanding)}</span></div></div>
      <div className="text-xs text-ink-3 mt-8">Delivery {fmtDate(o.order.delivery_date)}. Thank you for choosing {getSetting("brand_name")}.</div>
      <div className="mt-6 flex gap-2 no-print"><PrintButton label="Print / save PDF" /><Link href={`/orders/${o.order.id}`} className="btn-secondary btn-sm">Back</Link></div>
    </div>
  );
  return (
    <div>
      <PageHeader kicker={<span>{o.order.order_number} · <StatusBadge status={o.order.status} /> · <StatusBadge status={o.order.payment_status} /></span>} title={o.client.name} actions={<>
        <Link href={`/clients/${o.client.id}`} className="btn-secondary btn-sm">Client</Link>
        {o.order.meal_plan_id && <Link href={`/meal-plans/${o.order.meal_plan_id}`} className="btn-secondary btn-sm">Meal plan</Link>}
        <Link href={`/orders/${o.order.id}?view=invoice`} className="btn-secondary btn-sm">Invoice</Link>
        {can(user, "labels:view") && <Link href={`/packaging/${o.order.id}`} className="btn-primary btn-sm">Labels</Link>}
      </>}>Delivery {fmtDate(o.order.delivery_date)} · {o.order.delivery_address} · {o.order.people_served > 1 ? `${o.order.people_served} people per meal · ` : ""}{o.items.reduce((s, i) => s + i.quantity, 0)} meals</PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Meals" className="lg:col-span-2">
          <table className="table"><thead><tr><th>#</th><th>Meal</th><th>Day / slot</th><th>Qty</th><th>Price</th><th>Cost</th><th>Status</th></tr></thead><tbody>{o.items.map((i) => <tr key={i.id}><td>{i.meal_number}/{o.items.length}</td><td><CategoryDot category={i.category} /> <Link href={`/meals/${i.meal_id}`} className="hover:underline">{i.meal_name}</Link></td><td className="text-xs text-ink-2">{i.day_index != null ? DAY_NAMES[i.day_index] : ""} {i.slot}</td><td>{i.quantity}{i.portion_multiplier !== 1 ? ` × ${i.portion_multiplier}` : ""}</td><td>{formatZar(i.unit_price_zar)}</td><td className="text-ink-2">{formatZar(i.unit_cost_zar)}</td><td><StatusBadge status={i.status} /></td></tr>)}</tbody></table>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm"><div><div className="kicker">Subtotal</div>{formatZar(o.order.subtotal_zar)}</div><div><div className="kicker">Discount</div>−{formatZar(o.order.discount_zar)}</div><div><div className="kicker">Delivery fee</div>{formatZar(o.order.delivery_fee_zar)}</div><div><div className="kicker">Total</div><b>{formatZar(o.order.total_zar)}</b></div><div><div className="kicker">True cost</div>{formatZar(cost)}</div><div><div className="kicker">Gross profit</div>{formatZar(o.order.total_zar - o.order.delivery_fee_zar - cost)}</div><div><div className="kicker">Margin</div>{o.order.total_zar ? Math.round(((o.order.total_zar - o.order.delivery_fee_zar - cost) / (o.order.total_zar - o.order.delivery_fee_zar)) * 100) : 0}%</div><div><div className="kicker">Paid</div>{formatZar(o.paid)}</div></div>
        </Card>
        <div className="space-y-4">
          <Card title="Status" kicker="Production & delivery update this automatically">
            {can(user, "orders:edit") && <form action={setOrderStatusAction} className="flex gap-2"><input type="hidden" name="order_id" value={o.order.id} /><select name="status" defaultValue={o.order.status} className="input">{ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select><button className="btn-secondary btn-sm">Set</button></form>}
            {o.delivery && <div className="text-sm mt-3">Delivery: <StatusBadge status={o.delivery.status} /> {o.delivery.driver ? `· ${o.delivery.driver}` : ""} · {o.delivery.window_start}–{o.delivery.window_end}</div>}
            {o.order.notes && <div className="text-xs text-ink-2 mt-2">{o.order.notes}</div>}
          </Card>
          <Card title="Payments" kicker={outstanding > 0 ? `${formatZar(outstanding)} outstanding` : "Paid in full"}>
            <ul className="text-sm divide-y divide-line mb-3">{o.payments.map((p) => <li key={p.id} className="py-1.5 flex justify-between"><span>{fmtDate(p.paid_at)} · {p.method} {p.reference && <span className="text-ink-3">· {p.reference}</span>}</span><b>{formatZar(p.amount_zar)}</b></li>)}{o.payments.length === 0 && <li className="py-1.5 text-ink-3">No payments yet.</li>}</ul>
            {can(user, "finance:edit") && outstanding > 0 && (<>
              <form action={recordPaymentAction} className="grid grid-cols-2 gap-2"><input type="hidden" name="order_id" value={o.order.id} /><Field label="Amount"><input name="amount_zar" type="number" step="0.01" defaultValue={outstanding.toFixed(2)} className="input" /></Field><Field label="Method"><select name="method" className="input">{["eft", "card", "payfast", "stripe", "cash", "other"].map((m) => <option key={m}>{m}</option>)}</select></Field><Field label="Reference" className="col-span-2"><input name="reference" className="input" /></Field><div className="col-span-2"><button className="btn-primary btn-sm">Record payment → start production</button></div></form>
              <form action={sendPaymentReminder} className="mt-2"><input type="hidden" name="order_id" value={o.order.id} /><button className="btn-ghost btn-sm">Queue payment reminder</button></form>
            </>)}
          </Card>
        </div>
      </div>
    </div>
  );
}
