import Link from "next/link";
import { requirePermission, can } from "@/lib/auth";
import { listSuppliers, priceComparisonTable } from "@/lib/repo/inventory";
import { PageHeader, Card, Field, Empty } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { saveSupplierAction } from "@/app/actions";
import { parseJson } from "@/lib/types";

export default async function Suppliers({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("suppliers:view");
  const { tab = "list" } = await searchParams;
  const suppliers = listSuppliers();
  const table = priceComparisonTable();
  return (
    <div>
      <PageHeader kicker="Purchasing" title="Suppliers" actions={<><Link href="/suppliers" className="btn-secondary btn-sm">Profiles</Link><Link href="/suppliers?tab=compare" className="btn-secondary btn-sm">Price comparison</Link></>}>Profiles, product prices per kg/L/each, and a weighted recommendation (price 60 %, reliability 25 %, quality 15 %).</PageHeader>
      {tab === "compare" ? (
        <Card title="Price comparison" kicker="★ recommended">
          {table.length === 0 ? <Empty>No supplier prices recorded.</Empty> : <table className="table"><thead><tr><th>Ingredient</th><th>Options</th></tr></thead><tbody>{table.map((r) => <tr key={r.ingredient_id}><td className="font-medium">{r.ingredient}</td><td><div className="flex flex-wrap gap-2">{r.options.map((o) => <span key={o.supplier_id} className={`badge ${o.recommended ? "bg-ink text-white" : "bg-bone-2 text-ink-2"}`}>{o.recommended ? "★ " : ""}{o.supplier} — {formatZar(o.price_per_unit * (r.unit === "each" ? 1 : 1000))}/{r.unit === "each" ? "ea" : r.unit === "g" ? "kg" : "L"} · score {o.score}</span>)}</div></td></tr>)}</tbody></table>}
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <table className="table"><thead><tr><th>Supplier</th><th>Contact</th><th>Products</th><th>Min order</th><th>Delivers</th><th>Lead</th><th>Reliability</th><th>Quality</th><th></th></tr></thead><tbody>{suppliers.map((s) => <tr key={s.id} className={s.is_active ? "" : "opacity-50"}><td className="font-medium">{s.name}</td><td className="text-xs text-ink-2">{s.contact_name}<br />{s.phone}</td><td>{s.products}</td><td>{formatZar(s.min_order_zar)}</td><td className="text-xs">{parseJson<string[]>(s.delivery_days, []).join(", ")}</td><td>{s.lead_time_days} d</td><td>{"★".repeat(s.reliability)}</td><td>{"★".repeat(s.quality)}</td><td><Link href={`/suppliers/${s.id}`} className="btn-ghost btn-sm">Open</Link></td></tr>)}</tbody></table>
          </Card>
          {can(user, "suppliers:edit") && <Card title="Add supplier"><SupplierForm /></Card>}
        </div>
      )}
    </div>
  );
}

export function SupplierForm({ s }: { s?: ReturnType<typeof listSuppliers>[number] }) {
  const days = parseJson<string[]>(s?.delivery_days, []);
  return (
    <form action={saveSupplierAction} className="grid grid-cols-2 gap-2">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Name" className="col-span-2"><input name="name" defaultValue={s?.name ?? ""} className="input" required /></Field>
      <Field label="Contact"><input name="contact_name" defaultValue={s?.contact_name ?? ""} className="input" /></Field>
      <Field label="Phone"><input name="phone" defaultValue={s?.phone ?? ""} className="input" /></Field>
      <Field label="Email" className="col-span-2"><input name="email" defaultValue={s?.email ?? ""} className="input" /></Field>
      <Field label="Minimum order (R)"><input name="min_order_zar" type="number" defaultValue={s?.min_order_zar ?? 0} className="input" /></Field>
      <Field label="Lead time (days)"><input name="lead_time_days" type="number" defaultValue={s?.lead_time_days ?? 1} className="input" /></Field>
      <Field label="Reliability (1–5)"><input name="reliability" type="number" min={1} max={5} defaultValue={s?.reliability ?? 4} className="input" /></Field>
      <Field label="Quality (1–5)"><input name="quality" type="number" min={1} max={5} defaultValue={s?.quality ?? 4} className="input" /></Field>
      <div className="col-span-2"><span className="label">Delivery days</span><div className="flex gap-2 text-xs">{["mon", "tue", "wed", "thu", "fri", "sat"].map((d) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name="delivery_days" value={d} defaultChecked={days.includes(d)} />{d}</label>)}</div></div>
      <Field label="Notes" className="col-span-2"><textarea name="notes" rows={2} defaultValue={s?.notes ?? ""} className="input" /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={s ? !!s.is_active : true} /> Active</label>
      <div><button className="btn-primary btn-sm">Save</button></div>
    </form>
  );
}
