import { requirePermission } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { getDb } from "@/lib/db";
import { mealProfiles } from "@/lib/repo/meals";
import BreakEven from "@/components/BreakEven";

export default async function BreakEvenPage() {
  await requirePermission("business:view");
  const fixed = (getDb().prepare("SELECT COALESCE(SUM(amount_zar),0) AS s FROM expenses WHERE is_recurring = 1 AND incurred_at >= date('now','start of month')").get() as { s: number }).s;
  const p = mealProfiles();
  const avgPrice = p.length ? p.reduce((a, m) => a + m.price, 0) / p.length : 100;
  const avgCost = p.length ? p.reduce((a, m) => a + m.cost, 0) / p.length : 50;
  return (
    <div className="max-w-4xl">
      <PageHeader kicker="Planning" title="Break-even calculator">Pre-filled from this month’s recurring expenses and your menu averages. Every figure is editable.</PageHeader>
      <Card><BreakEven fixed={Math.round(fixed) || 20000} price={Math.round(avgPrice)} variable={Math.round(avgCost)} /></Card>
    </div>
  );
}
