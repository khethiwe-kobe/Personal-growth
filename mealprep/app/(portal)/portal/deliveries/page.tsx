import { requireClient } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, StatusBadge, fmtDate, Empty } from "@/components/ui";

export default async function Deliveries() {
  const user = await requireClient();
  const rows = getDb().prepare("SELECT d.*, o.order_number FROM deliveries d JOIN orders o ON o.id = d.order_id WHERE d.client_id = ? ORDER BY d.delivery_date DESC").all(user.client_id) as { id: number; delivery_date: string; window_start: string; window_end: string; address: string; status: string; proof_note: string; delivered_at: string | null; order_number: string }[];
  return <div className="space-y-4"><h1 className="text-3xl">My deliveries</h1><Card>{rows.length === 0 ? <Empty>No deliveries yet.</Empty> : <table className="table"><thead><tr><th>Date</th><th>Window</th><th>Address</th><th>Order</th><th>Status</th><th>Delivered</th></tr></thead><tbody>{rows.map((d) => <tr key={d.id}><td>{fmtDate(d.delivery_date)}</td><td>{d.window_start}–{d.window_end}</td><td className="text-xs">{d.address}</td><td className="text-xs">{d.order_number}</td><td><StatusBadge status={d.status} /></td><td className="text-xs">{d.delivered_at ? `${fmtDate(d.delivered_at)} ${d.proof_note}` : "—"}</td></tr>)}</tbody></table>}</Card></div>;
}
