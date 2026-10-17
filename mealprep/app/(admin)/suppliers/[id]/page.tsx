import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, can } from "@/lib/auth";
import { getSupplier } from "@/lib/repo/inventory";
import { listIngredients } from "@/lib/repo/meals";
import { PageHeader, Card, Field, StatusBadge, fmtDate } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { setSupplierPriceAction } from "@/app/actions";
import { SupplierForm } from "../page";
import { getDb } from "@/lib/db";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("suppliers:view");
  const { id } = await params;
  const s = getSupplier(Number(id));
  if (!s) notFound();
  const history = getDb().prepare("SELECT h.price_per_unit, h.recorded_at, i.name FROM supplier_price_history h JOIN supplier_products sp ON sp.id = h.supplier_product_id JOIN ingredients i ON i.id = sp.ingredient_id WHERE sp.supplier_id = ? ORDER BY h.recorded_at DESC LIMIT 30").all(s.supplier.id) as { price_per_unit: number; recorded_at: string; name: string }[];
  return (
    <div>
      <PageHeader kicker="Supplier" title={s.supplier.name} actions={<Link href="/suppliers" className="btn-secondary btn-sm">All suppliers</Link>}>{s.supplier.contact_name} · {s.supplier.phone} · {s.supplier.email} · lead time {s.supplier.lead_time_days} d · min order {formatZar(s.supplier.min_order_zar)}</PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Products & prices" className="lg:col-span-2" kicker="Price per kg / L / each">
          <table className="table"><thead><tr><th>Ingredient</th><th>Price</th><th>Pack</th><th>Updated</th></tr></thead><tbody>{s.products.map((p) => <tr key={p.id}><td>{p.ingredient}</td><td>{formatZar(p.price_per_unit * (p.unit === "each" ? 1 : 1000))}/{p.unit === "each" ? "ea" : p.unit === "g" ? "kg" : "L"}</td><td>{p.pack_size} {p.unit}</td><td className="text-xs text-ink-2">{fmtDate(p.updated_at)}</td></tr>)}</tbody></table>
          {can(user, "suppliers:edit") && <form action={setSupplierPriceAction} className="grid grid-cols-4 gap-2 mt-4 items-end"><input type="hidden" name="supplier_id" value={s.supplier.id} /><Field label="Ingredient"><select name="ingredient_id" className="input">{listIngredients().map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field><Field label="Price per base unit (R/g, R/ml, R/each)"><input name="price_per_unit" type="number" step="0.0001" className="input" required /></Field><Field label="Pack size"><input name="pack_size" type="number" defaultValue={1000} className="input" /></Field><button className="btn-primary btn-sm">Set price</button></form>}
          <div className="kicker mt-5 mb-1">Price history</div>
          <ul className="text-xs text-ink-2 space-y-0.5">{history.map((h, i) => <li key={i}>{fmtDate(h.recorded_at)} · {h.name} · {formatZar(h.price_per_unit * 1000)}/kg|L</li>)}</ul>
        </Card>
        <div className="space-y-4">
          <Card title="Purchase history">{s.purchases.length === 0 ? <div className="text-sm text-ink-3">No purchase orders.</div> : <ul className="text-sm divide-y divide-line">{s.purchases.map((p) => <li key={p.id} className="py-1.5 flex justify-between"><span>PO #{p.id} · {fmtDate(p.created_at)}</span><span>{formatZar(p.total_zar)} <StatusBadge status={p.status} /></span></li>)}</ul>}</Card>
          {can(user, "suppliers:edit") && <Card title="Edit supplier"><SupplierForm s={{ ...s.supplier, products: s.products.length }} /></Card>}
        </div>
      </div>
    </div>
  );
}
