import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { listClients } from "@/lib/repo/clients";
import { listPlans } from "@/lib/repo/orders";
import { todayIso } from "@/lib/finance";

const R = ({ title, desc, links }: { title: string; desc: string; links: { label: string; href: string }[] }) => <Card title={title}><p className="text-xs text-ink-2 mb-3">{desc}</p><div className="flex flex-wrap gap-2">{links.map((l) => <Link key={l.href} href={l.href} className="btn-secondary btn-sm">{l.label}</Link>)}</div></Card>;

export default async function Reports() {
  await requirePermission("analytics:view");
  const clients = listClients().slice(0, 50);
  const plans = listPlans().slice(0, 30);
  const d = todayIso();
  return (
    <div>
      <PageHeader kicker="Reports" title="Downloadable reports">CSV for spreadsheets and accounting; printable pages (use the browser&apos;s Save as PDF) for client-facing documents.</PageHeader>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card title="Client nutrition report"><p className="text-xs text-ink-2 mb-2">Printable nutrition analysis per client (Nutrition tab) and a JSON export of all their data.</p><div className="flex flex-wrap gap-1 mt-2">{clients.slice(0, 6).map((c) => <Link key={c.id} href={`/clients/${c.id}?tab=nutrition`} className="badge bg-bone-2 text-ink-2">{c.first_name}</Link>)}</div></Card>
        <Card title="Weekly meal plan"><p className="text-xs text-ink-2 mb-2">Printable plan or CSV for the latest plans.</p><ul className="text-xs space-y-1">{plans.slice(0, 6).map((p) => <li key={p.id} className="flex justify-between"><span>{p.client_name} · {p.week_start}</span><span><Link href={`/meal-plans/${p.id}?tab=print`} className="text-accent">print</Link> · <Link href={`/api/export/plan/${p.id}`} className="text-accent">csv</Link></span></li>)}</ul></Card>
        <R title="Grocery list" desc="Master purchase list for a delivery window." links={[{ label: "Next 7 days CSV", href: `/api/export/grocery?from=${d}&to=${d.slice(0, 8)}${String(Number(d.slice(8)) + 7).padStart(2, "0")}` }, { label: "Open grocery screen", href: "/grocery" }]} />
        <R title="Kitchen production report" desc="Batches, quantities and status for a date." links={[{ label: `Today CSV`, href: `/api/export/production?date=${d}` }, { label: "Production board", href: "/production" }]} />
        <R title="Packaging report" desc="Labels per order (printable sheets)." links={[{ label: "Packaging queue", href: "/packaging" }]} />
        <R title="Delivery report" desc="Route sheet with addresses, windows and proof." links={[{ label: "Today CSV", href: `/api/export/deliveries?date=${d}` }, { label: "Deliveries", href: "/deliveries" }]} />
        <R title="Invoices" desc="Printable invoice per order." links={[{ label: "Orders", href: "/orders?view=table" }]} />
        <R title="Client progress report" desc="Weight, adherence, energy and satisfaction charts per client." links={clients.slice(0, 3).map((c) => ({ label: c.first_name, href: `/clients/${c.id}?tab=progress` }))} />
        <R title="Monthly business report" desc="Revenue, expenses, COGS, profit and orders per month." links={[{ label: "Monthly CSV", href: "/api/export/monthly" }, { label: "Finance dashboard", href: "/finance" }]} />
        <R title="Profitability report" desc="Gross profit per meal over 90 days." links={[{ label: "Profitability CSV", href: "/api/export/profitability" }]} />
        <R title="Inventory report" desc="Stock on hand, minimums, next expiry and value." links={[{ label: "Inventory CSV", href: "/api/export/inventory" }]} />
        <R title="Orders & payments" desc="For bookkeeping (Xero / Sheets import)." links={[{ label: "Orders CSV", href: "/api/export/orders" }, { label: "Payments CSV", href: "/api/export/payments" }, { label: "Expenses CSV", href: "/api/export/expenses" }]} />
      </div>
    </div>
  );
}
