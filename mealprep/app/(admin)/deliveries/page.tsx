import Link from "next/link";
import { requirePermission, can } from "@/lib/auth";
import { deliveriesForDate, drivers, upcomingDeliveries } from "@/lib/repo/production";
import { PageHeader, Card, StatusBadge, Empty, Stat, fmtDate } from "@/components/ui";
import { DELIVERY_STATUSES } from "@/lib/types";
import { assignDriverAction, setDeliveryStatusAction, buildRouteAction } from "@/app/actions";
import { todayIso, shiftDays } from "@/lib/finance";

export default async function Deliveries({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requirePermission("deliveries:view");
  const { date = todayIso() } = await searchParams;
  const rows = deliveriesForDate(date);
  const ds = drivers();
  const edit = can(user, "deliveries:edit");
  const isDriver = user.role === "delivery";
  const mine = isDriver ? rows.filter((r) => r.driver_id === user.id || !r.driver_id) : rows;
  return (
    <div>
      <PageHeader kicker="Delivery" title={`Deliveries · ${date}`} actions={<><Link href={`/deliveries?date=${shiftDays(date, -1)}`} className="btn-secondary btn-sm">← Prev</Link><Link href={`/deliveries?date=${todayIso()}`} className="btn-secondary btn-sm">Today</Link><Link href={`/deliveries?date=${shiftDays(date, 1)}`} className="btn-secondary btn-sm">Next →</Link><Link href={`/api/export/deliveries?date=${date}`} className="btn-secondary btn-sm">CSV</Link></>}>Assign drivers, build the daily route, record proof of delivery. Completing a delivery triggers the feedback request automatically.</PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"><Stat label="Stops" value={rows.length} /><Stat label="Pending" value={rows.filter((r) => r.status === "pending").length} tone={rows.some((r) => r.status === "pending") ? "warn" : "good"} /><Stat label="On the road" value={rows.filter((r) => r.status === "out_for_delivery").length} /><Stat label="Delivered" value={rows.filter((r) => r.status === "delivered").length} tone="good" /><Stat label="Failed" value={rows.filter((r) => r.status === "failed").length} tone={rows.some((r) => r.status === "failed") ? "critical" : "neutral"} /></div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Route sheet" className="lg:col-span-2" action={edit ? <form action={buildRouteAction} className="flex gap-1"><input type="hidden" name="date" value={date} /><select name="driver_id" className="input !py-1 !text-xs"><option value="">Unassigned stops</option>{ds.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button className="btn-secondary btn-sm">Build route</button></form> : undefined}>
          {mine.length === 0 ? <Empty>No deliveries on {date}.</Empty> : <table className="table"><thead><tr><th>#</th><th>Client</th><th>Address</th><th>Window</th><th>Meals</th><th>Driver</th><th>Status</th>{edit && <th>Update</th>}</tr></thead><tbody>{mine.map((d) => <tr key={d.id}><td>{d.sequence || "—"}</td><td className="font-medium">{d.client_name}<div className="text-[11px] text-ink-3">{d.phone} · {d.order_number}</div></td><td className="text-xs">{d.address}{d.delivery_notes && <div className="text-ink-3">{d.delivery_notes}</div>}</td><td className="text-xs">{d.window_start}–{d.window_end}</td><td>{d.meals}</td><td className="text-xs">{edit && !isDriver ? <form action={assignDriverAction} className="flex gap-1"><input type="hidden" name="delivery_id" value={d.id} /><input type="hidden" name="window_start" value={d.window_start} /><input type="hidden" name="window_end" value={d.window_end} /><select name="driver_id" defaultValue={d.driver_id ?? ""} className="input !py-0.5 !text-xs"><option value="">—</option>{ds.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><button className="btn-secondary btn-sm">Set</button></form> : d.driver_name ?? "—"}</td><td><StatusBadge status={d.status} />{d.proof_note && <div className="text-[11px] text-ink-3">{d.proof_type}: {d.proof_note}</div>}{d.failure_reason && <div className="text-[11px] text-critical">{d.failure_reason}</div>}</td>{edit && <td><form action={setDeliveryStatusAction} className="flex flex-col gap-1"><input type="hidden" name="delivery_id" value={d.id} /><select name="status" defaultValue={d.status} className="input !py-0.5 !text-xs">{DELIVERY_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select><select name="proof_type" className="input !py-0.5 !text-xs"><option value="">proof…</option>{["photo", "signature", "pin", "note"].map((p) => <option key={p}>{p}</option>)}</select><input name="proof_note" placeholder="proof note / recipient" className="input !py-0.5 !text-xs" /><input name="failure_reason" placeholder="failure reason" className="input !py-0.5 !text-xs" /><button className="btn-primary btn-sm">Save</button></form></td>}</tr>)}</tbody></table>}
        </Card>
        <Card title="Upcoming" kicker="Next 7 days">{upcomingDeliveries(7).length === 0 ? <Empty>Nothing scheduled.</Empty> : <ul className="text-sm divide-y divide-line">{upcomingDeliveries(7).map((d) => <li key={d.id} className="py-1.5 flex justify-between"><span><Link href={`/deliveries?date=${d.delivery_date}`} className="hover:underline">{fmtDate(d.delivery_date)}</Link> · {d.client_name}</span><StatusBadge status={d.status} /></li>)}</ul>}</Card>
      </div>
    </div>
  );
}
