import Link from "next/link";
import { requirePermission, can } from "@/lib/auth";
import { listExpenses } from "@/lib/repo/orders";
import { listSuppliers } from "@/lib/repo/inventory";
import { PageHeader, Card, Field, fmtDate, Empty } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { addExpenseAction } from "@/app/actions";
import { expensesByCategory, startOfMonth, todayIso } from "@/lib/finance";
import { Donut } from "@/components/charts";

const CATS = ["food", "packaging", "labour", "delivery", "marketing", "rent", "utilities", "software", "insurance", "licensing", "equipment", "other"];

export default async function Expenses({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requirePermission("finance:view");
  const { from, to } = await searchParams;
  const rows = listExpenses({ from, to });
  const month = expensesByCategory({ from: startOfMonth(), to: todayIso() });
  const parts = Object.entries(month).sort((a, b) => b[1] - a[1]);
  const top = parts.slice(0, 5).map(([name, value]) => ({ name, value }));
  const other = parts.slice(5).reduce((s, [, v]) => s + v, 0);
  if (other) top.push({ name: "Other", value: other });
  return (
    <div>
      <PageHeader kicker="Finance" title="Expenses" actions={<Link href="/api/export/expenses" className="btn-secondary btn-sm">CSV</Link>}>Stock receipts post a food expense automatically; everything else is recorded here. Categories feed the finance dashboard and break-even calculator.</PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Expense log" className="lg:col-span-2" action={<form className="flex gap-1"><input name="from" type="date" defaultValue={from ?? ""} className="input !py-1 !text-xs" /><input name="to" type="date" defaultValue={to ?? ""} className="input !py-1 !text-xs" /><button className="btn-secondary btn-sm">Filter</button></form>}>
          {rows.length === 0 ? <Empty>No expenses.</Empty> : <table className="table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>Recurring</th></tr></thead><tbody>{rows.slice(0, 200).map((e) => <tr key={e.id}><td className="text-xs">{fmtDate(e.incurred_at)}</td><td className="capitalize">{e.category}</td><td className="text-xs text-ink-2">{e.description}</td><td className="font-medium">{formatZar(e.amount_zar)}</td><td className="text-xs">{e.is_recurring ? "monthly" : ""}</td></tr>)}</tbody></table>}
        </Card>
        <div className="space-y-4">
          <Card title="This month by category">{parts.length ? <Donut parts={top} label={formatZar(parts.reduce((s, [, v]) => s + v, 0)).replace(/,00$/, "")} /> : <Empty>No expenses this month.</Empty>}</Card>
          {can(user, "finance:edit") && <Card title="Add expense"><form action={addExpenseAction} className="grid grid-cols-2 gap-2"><Field label="Category"><select name="category" className="input">{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Amount (R)"><input name="amount_zar" type="number" step="0.01" className="input" required /></Field><Field label="Date"><input name="incurred_at" type="date" defaultValue={todayIso()} className="input" /></Field><Field label="Supplier"><select name="supplier_id" className="input"><option value="">—</option>{listSuppliers().map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Description" className="col-span-2"><input name="description" className="input" /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_recurring" /> Recurring monthly</label><div><button className="btn-primary btn-sm">Add</button></div></form></Card>}
        </div>
      </div>
    </div>
  );
}
