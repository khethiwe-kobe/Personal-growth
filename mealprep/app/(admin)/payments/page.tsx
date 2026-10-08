import Link from "next/link";
import { requirePermission, can } from "@/lib/auth";
import { listPayments, pendingPayments } from "@/lib/repo/orders";
import { PageHeader, Card, StatusBadge, fmtDate, Empty, Stat } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { recordPaymentAction, sendPaymentReminder } from "@/app/actions";
import { startOfMonth, todayIso, revenue } from "@/lib/finance";

export default async function Payments({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requirePermission("finance:view");
  const { from, to } = await searchParams;
  const rows = listPayments({ from, to });
  const pending = pendingPayments();
  return (
    <div>
      <PageHeader kicker="Finance" title="Payments" actions={<Link href="/api/export/payments" className="btn-secondary btn-sm">CSV (Xero)</Link>}>Recording a payment moves the order to Paid and into the production queue automatically. PayFast/Stripe webhooks can call the same function.</PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"><Stat label="Received this month" value={formatZar(revenue({ from: startOfMonth(), to: todayIso() }))} /><Stat label="Outstanding" value={formatZar(pending.reduce((s, o) => s + o.total_zar, 0))} sub={`${pending.length} orders`} tone={pending.length ? "warn" : "good"} /><Stat label="Payments listed" value={rows.length} /><Stat label="Average payment" value={formatZar(rows.length ? rows.reduce((s, p) => s + p.amount_zar, 0) / rows.length : 0)} /></div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Awaiting payment" className="lg:col-span-1">{pending.length === 0 ? <Empty>Nothing outstanding.</Empty> : <ul className="divide-y divide-line text-sm">{pending.map((o) => <li key={o.id} className="py-2"><div className="flex justify-between"><Link href={`/orders/${o.id}`} className="font-medium hover:underline">{o.client_name}</Link><b>{formatZar(o.total_zar)}</b></div><div className="text-xs text-ink-2">{o.order_number} · delivery {fmtDate(o.delivery_date)} · <StatusBadge status={o.status} /></div>{can(user, "finance:edit") && <div className="flex gap-1 mt-1"><form action={recordPaymentAction}><input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="amount_zar" value={o.total_zar} /><input type="hidden" name="method" value="eft" /><button className="btn-primary btn-sm">Mark paid</button></form><form action={sendPaymentReminder}><input type="hidden" name="order_id" value={o.id} /><button className="btn-secondary btn-sm">Remind</button></form></div>}</li>)}</ul>}</Card>
        <Card title="Payment history" className="lg:col-span-2" action={<form className="flex gap-1"><input name="from" type="date" defaultValue={from ?? ""} className="input !py-1 !text-xs" /><input name="to" type="date" defaultValue={to ?? ""} className="input !py-1 !text-xs" /><button className="btn-secondary btn-sm">Filter</button></form>}>
          {rows.length === 0 ? <Empty>No payments.</Empty> : <table className="table"><thead><tr><th>Date</th><th>Client</th><th>Order</th><th>Method</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>{rows.slice(0, 200).map((p) => <tr key={p.id}><td className="text-xs">{fmtDate(p.paid_at)}</td><td>{p.client_name}</td><td className="text-xs">{p.order_number ?? "—"}</td><td className="text-xs">{p.method}</td><td className="text-xs text-ink-2">{p.reference}</td><td className="font-medium">{formatZar(p.amount_zar)}</td><td><StatusBadge status={p.status === "completed" ? "paid" : p.status} /></td></tr>)}</tbody></table>}
        </Card>
      </div>
    </div>
  );
}
