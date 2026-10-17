import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { WORKFLOW_STEPS } from "@/lib/business";

export default async function Workflow() {
  await requirePermission("dashboard:view");
  const db = getDb();
  const c = async (sql: string) => (await db.prepare(sql).get() as { n: number }).n;
  const counts: Record<string, string> = {
    new_client: `${await c("SELECT COUNT(*) n FROM clients WHERE status IN ('lead','onboarding')")} leads / onboarding`,
    assessment: `${await c("SELECT COUNT(*) n FROM client_health_profiles")} profiles`,
    nutrition: `${await c("SELECT COUNT(*) n FROM client_nutrition_targets WHERE requires_professional_review = 1")} review flags`,
    goal: `${await c("SELECT COUNT(*) n FROM client_goals WHERE status = 'active'")} active goals`,
    plan: `${await c("SELECT COUNT(*) n FROM meal_plans WHERE status = 'draft'")} drafts`,
    approval: `${await c("SELECT COUNT(*) n FROM meal_plans WHERE status = 'proposed'")} awaiting approval`,
    order: `${await c("SELECT COUNT(*) n FROM orders WHERE status IN ('inquiry','quote_sent')")} quotes`,
    payment: `${await c("SELECT COUNT(*) n FROM orders WHERE status = 'awaiting_payment'")} awaiting payment`,
    grocery: `${await c("SELECT COUNT(*) n FROM orders WHERE status IN ('paid','plan_created')")} paid, not shopped`,
    inventory: `${await c("SELECT COUNT(*) n FROM (SELECT i.id FROM ingredients i LEFT JOIN inventory_lots l ON l.ingredient_id=i.id WHERE i.min_stock>0 GROUP BY i.id HAVING COALESCE(SUM(l.quantity_remaining),0) < i.min_stock)")} low stock`,
    purchasing: `${await c("SELECT COUNT(*) n FROM purchase_orders WHERE status = 'sent'")} open POs`,
    production: `${await c("SELECT COUNT(*) n FROM production_batches WHERE status IN ('preparing','cooking')")} cooking`,
    portioning: `${await c("SELECT COUNT(*) n FROM production_batches WHERE status = 'portioning'")} portioning`,
    packaging: `${await c("SELECT COUNT(*) n FROM production_batches WHERE status = 'packaging'")} packaging`,
    qc: `${await c("SELECT COUNT(*) n FROM production_batches WHERE status = 'quality_check'")} in QC`,
    delivery: `${await c("SELECT COUNT(*) n FROM deliveries WHERE status IN ('assigned','out_for_delivery')")} on the road`,
    feedback: `${await c("SELECT COUNT(*) n FROM feedback WHERE created_at >= date_text('now','-7 days')")} this week`,
    progress: `${await c("SELECT COUNT(*) n FROM client_progress WHERE logged_at >= date_text('now','-7 days')")} check-ins`,
    renewal: `${await c("SELECT COUNT(*) n FROM subscriptions WHERE status='active' AND renewal_date <= date_text('now','+7 days')")} due`,
  };
  return (
    <div>
      <PageHeader kicker="End to end" title="Business workflow">Every stage of the client journey is a live count linking to the screen where the work happens.</PageHeader>
      <Card>
        <ol className="grid md:grid-cols-2 xl:grid-cols-4 gap-2">
          {WORKFLOW_STEPS.map((s, idx) => (
            <li key={s.key}>
              <Link href={s.href} className="block rounded-xl border border-line p-3 hover:border-accent hover:bg-bone-2/50 transition-colors h-full">
                <div className="kicker">Step {idx + 1}</div>
                <div className="font-medium mt-0.5">{s.label}</div>
                <div className="text-xs text-ink-2 mt-1">{s.desc}</div>
                <div className="text-xs text-accent mt-2">{counts[s.key]}</div>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
