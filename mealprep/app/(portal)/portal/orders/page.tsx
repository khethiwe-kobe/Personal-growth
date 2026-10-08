import { requireClient } from "@/lib/auth";
import { listOrders } from "@/lib/repo/orders";
import { Card, StatusBadge, fmtDate, Empty } from "@/components/ui";
import { formatZar } from "@/lib/costing";

export default async function Orders() {
  const user = await requireClient();
  const rows = listOrders({ clientId: user.client_id });
  return <div className="space-y-4"><h1 className="text-3xl">My orders</h1><Card>{rows.length === 0 ? <Empty>No orders yet.</Empty> : <table className="table"><thead><tr><th>Order</th><th>Delivery</th><th>Meals</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>{rows.map((o) => <tr key={o.id}><td>{o.order_number}</td><td>{fmtDate(o.delivery_date)}</td><td>{o.meals}</td><td>{formatZar(o.total_zar)}</td><td><StatusBadge status={o.payment_status} /></td><td><StatusBadge status={o.status} /></td></tr>)}</tbody></table>}</Card></div>;
}
