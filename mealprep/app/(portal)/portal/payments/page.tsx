import { requireClient } from "@/lib/auth";
import { listPayments, listOrders } from "@/lib/repo/orders";
import { Card, StatusBadge, fmtDate, Empty } from "@/components/ui";
import { formatZar } from "@/lib/costing";

export default async function Payments() {
  const user = await requireClient();
  const rows = listPayments().filter((p) => p.client_id === user.client_id);
  const due = listOrders({ clientId: user.client_id }).filter((o) => o.payment_status !== "paid" && !["cancelled", "inquiry", "quote_sent"].includes(o.status));
  return <div className="space-y-4"><h1 className="text-3xl">My payments</h1>{due.length > 0 && <Card title="Awaiting payment" kicker="EFT reference = order number"><ul className="text-sm">{due.map((o) => <li key={o.id} className="flex justify-between py-1"><span>{o.order_number} · delivery {fmtDate(o.delivery_date)}</span><b>{formatZar(o.total_zar)}</b></li>)}</ul></Card>}<Card title="History">{rows.length === 0 ? <Empty>No payments yet.</Empty> : <table className="table"><thead><tr><th>Date</th><th>Order</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>{rows.map((p) => <tr key={p.id}><td>{fmtDate(p.paid_at)}</td><td>{p.order_number ?? "—"}</td><td>{p.method}</td><td>{formatZar(p.amount_zar)}</td><td><StatusBadge status={p.status === "completed" ? "paid" : p.status} /></td></tr>)}</tbody></table>}</Card></div>;
}
