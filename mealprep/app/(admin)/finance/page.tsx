import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { summary, monthlySeries, customerMetrics, mealProfitability, startOfMonth, startOfWeek, todayIso, shiftMonths } from "@/lib/finance";
import { PageHeader, Card, Stat } from "@/components/ui";
import { BarChart, LineChart, Donut } from "@/components/charts";
import { formatZar, formatZar0 } from "@/lib/costing";

export default async function Finance({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePermission("finance:view");
  const sp = await searchParams;
  const from = sp.from ?? startOfMonth(), to = sp.to ?? todayIso();
  const s = summary({ from, to });
  const today = summary({ from: todayIso(), to: todayIso() });
  const week = summary({ from: startOfWeek(), to: todayIso() });
  const month = summary({ from: startOfMonth(), to: todayIso() });
  const prev = summary({ from: shiftMonths(startOfMonth(), -1), to: shiftMonths(todayIso(), -1) });
  const series = monthlySeries(6);
  const cm = customerMetrics();
  const prof = mealProfitability(90).slice(0, 8);
  const delta = prev.revenue ? ((month.revenue - prev.revenue) / prev.revenue) * 100 : 0;
  return (
    <div>
      <PageHeader kicker="Finance" title="Business finance" actions={<><Link href="/api/export/monthly" className="btn-secondary btn-sm">Monthly CSV</Link><Link href="/api/export/profitability" className="btn-secondary btn-sm">Profitability CSV</Link></>}>Revenue is cash received; COGS is the cost snapshot on delivered order items; operating expenses exclude food and packaging to avoid double counting.</PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-5">
        <Stat label="Today's revenue" value={formatZar0(today.revenue)} />
        <Stat label="Weekly revenue" value={formatZar0(week.revenue)} />
        <Stat label="Monthly revenue" value={formatZar0(month.revenue)} sub={`${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs same point last month`} tone={delta >= 0 ? "good" : "critical"} />
        <Stat label="Monthly expenses" value={formatZar0(month.total_expenses)} sub={`COGS ${formatZar0(month.cogs.total)} + opex`} />
        <Stat label="Gross profit (MTD)" value={formatZar0(month.gross_profit)} sub={`${month.gross_margin_pct.toFixed(0)}% margin`} tone="good" />
        <Stat label="Net profit estimate" value={formatZar0(month.net_profit)} sub={`${month.net_margin_pct.toFixed(0)}% net margin`} tone={month.net_profit >= 0 ? "good" : "critical"} />
        <Stat label="Average order value" value={formatZar0(cm.avg_order_value)} />
        <Stat label="Customer acquisition cost" value={formatZar0(cm.cac)} sub="marketing ÷ new clients (90 d)" />
        <Stat label="Customer lifetime value" value={formatZar0(cm.clv)} sub="AOV × orders × margin × 1.5 yrs" />
        <Stat label="Repeat customer rate" value={`${cm.repeat_rate.toFixed(0)}%`} sub={`${cm.avg_orders_per_client.toFixed(1)} orders / client`} />
        <Stat label="Food cost %" value={`${month.food_cost_pct.toFixed(0)}%`} sub="of revenue (MTD)" tone={month.food_cost_pct > 40 ? "warn" : "good"} />
        <Stat label="Meals sold (MTD)" value={month.meals_sold} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Revenue, COGS and profit by month" className="lg:col-span-2"><BarChart labels={series.map((m) => m.month)} series={[{ name: "Revenue", values: series.map((m) => m.revenue) }, { name: "COGS", values: series.map((m) => m.cogs) }, { name: "Net profit", values: series.map((m) => Math.max(0, m.profit)) }]} unit="R" height={220} /></Card>
        <Card title="Where the money goes" kicker="Selected period"><Donut parts={[{ name: "Food", value: s.cogs.food }, { name: "Packaging", value: s.cogs.packaging }, { name: "Labour", value: s.cogs.labour + (s.expenses.labour ?? 0) }, { name: "Delivery", value: s.expenses.delivery ?? 0 }, { name: "Marketing", value: s.expenses.marketing ?? 0 }, { name: "Other opex", value: Object.entries(s.expenses).filter(([k]) => !["labour", "delivery", "marketing", "food", "packaging"].includes(k)).reduce((a, [, v]) => a + v, 0) }]} label={formatZar0(s.total_expenses)} /></Card>
        <Card title="Period summary" action={<form className="flex gap-1"><input name="from" type="date" defaultValue={from} className="input !py-1 !text-xs" /><input name="to" type="date" defaultValue={to} className="input !py-1 !text-xs" /><button className="btn-secondary btn-sm">Apply</button></form>}>
          <table className="table"><tbody>
            <tr><td>Revenue</td><td className="text-right font-medium">{formatZar(s.revenue)}</td></tr>
            <tr><td className="pl-6 text-ink-2">Food (COGS)</td><td className="text-right">{formatZar(s.cogs.food)}</td></tr>
            <tr><td className="pl-6 text-ink-2">Packaging</td><td className="text-right">{formatZar(s.cogs.packaging)}</td></tr>
            <tr><td className="pl-6 text-ink-2">Direct labour & overhead</td><td className="text-right">{formatZar(s.cogs.labour + s.cogs.overhead)}</td></tr>
            <tr><td>Gross profit</td><td className="text-right font-medium">{formatZar(s.gross_profit)} ({s.gross_margin_pct.toFixed(0)}%)</td></tr>
            {Object.entries(s.expenses).filter(([k]) => !["food", "packaging"].includes(k)).map(([k, v]) => <tr key={k}><td className="pl-6 text-ink-2 capitalize">{k}</td><td className="text-right">{formatZar(v)}</td></tr>)}
            <tr><td>Net profit estimate</td><td className={`text-right font-medium ${s.net_profit < 0 ? "text-critical" : ""}`}>{formatZar(s.net_profit)} ({s.net_margin_pct.toFixed(0)}%)</td></tr>
          </tbody></table>
        </Card>
        <Card title="Most profitable meals" kicker="Last 90 days" className="lg:col-span-2">
          <table className="table"><thead><tr><th>Meal</th><th>Sold</th><th>Revenue</th><th>Cost</th><th>Gross profit</th><th>Margin</th></tr></thead><tbody>{prof.map((m) => <tr key={m.id}><td className="font-medium">{m.name}</td><td>{m.sold}</td><td>{formatZar(m.revenue)}</td><td>{formatZar(m.cost)}</td><td>{formatZar(m.profit)}</td><td>{m.revenue ? Math.round((m.profit / m.revenue) * 100) : 0}%</td></tr>)}</tbody></table>
        </Card>
        <Card title="Orders per month"><LineChart labels={series.map((m) => m.month)} series={[{ name: "Orders", values: series.map((m) => m.orders) }]} height={180} /></Card>
      </div>
    </div>
  );
}
