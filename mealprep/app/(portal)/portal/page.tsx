import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { getClientFull } from "@/lib/repo/clients";
import { listPlans, listOrders, listSubscriptions, getPlanFull } from "@/lib/repo/orders";
import { upcomingDeliveries } from "@/lib/repo/production";
import { Card, Stat, StatusBadge, fmtDate, Empty, CategoryDot } from "@/components/ui";
import { Ring } from "@/components/charts";
import { DAY_NAMES, GOAL_LABELS, type GoalType } from "@/lib/types";
import { listProgress } from "@/lib/repo/clients";

export default async function PortalHome() {
  const user = await requireClient();
  const full = getClientFull(user.client_id)!;
  const t = full.computed;
  const plans = listPlans(user.client_id).filter((p) => ["proposed", "approved", "ordered"].includes(p.status));
  const today = new Date().toISOString().slice(0, 10);
  const inWeek = (p: { week_start: string }) => { const end = new Date(p.week_start + "T00:00:00"); end.setDate(end.getDate() + 7); return p.week_start <= today && today < end.toISOString().slice(0, 10); };
  const current = plans.find(inWeek) ?? [...plans].reverse().find((p) => p.week_start > today) ?? plans[0];
  const plan = current ? getPlanFull(current.id) : null;
  const todayIdx = (new Date().getDay() + 6) % 7;
  const todays = plan?.items.filter((i) => i.day_index === todayIdx) ?? [];
  const orders = listOrders({ clientId: user.client_id });
  const deliveries = upcomingDeliveries(14).filter((d) => d.client_id === user.client_id);
  const sub = listSubscriptions(user.client_id).find((s) => s.status === "active");
  const progress = listProgress(user.client_id);
  const latest = progress[progress.length - 1];
  const goal = full.goals.find((g) => g.is_primary);
  const kcalToday = todays.reduce((s, i) => s + i.meal.nutrition.kcal, 0);
  const proteinToday = todays.reduce((s, i) => s + i.meal.nutrition.protein, 0);
  return (
    <div className="space-y-5">
      <div><div className="kicker">Welcome back</div><h1 className="text-3xl">{full.client.first_name}, here is your week.</h1>{goal && <p className="text-sm text-ink-2 mt-1">Goal: {GOAL_LABELS[goal.goal_type as GoalType] ?? goal.goal_type}{goal.target_value ? ` · target ${goal.target_value} kg` : ""}</p>}</div>
      {t.requires_professional_review && !full.reviews.some((r) => r.outcome.startsWith("approved")) && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3">Based on your profile we recommend a professional review before your personalised plan is finalised. Our team will be in touch; meanwhile everything shown is general guidance.</div>}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Today's meals" value={todays.length} sub={plan ? `${kcalToday} kcal · ${Math.round(proteinToday)} g protein` : "no active plan"} href="/portal/plan" />
        <Stat label="Next delivery" value={deliveries[0] ? fmtDate(deliveries[0].delivery_date) : "—"} sub={deliveries[0] ? `${deliveries[0].window_start}–${deliveries[0].window_end}` : "nothing scheduled"} href="/portal/deliveries" />
        <Stat label="Subscription" value={sub ? `${sub.meals_per_week}/wk` : "—"} sub={sub ? `renews ${fmtDate(sub.renewal_date)}` : "no subscription"} href="/portal/subscription" />
        <Stat label="Latest weight" value={latest?.weight_kg ? `${latest.weight_kg} kg` : "—"} sub={latest ? fmtDate(latest.logged_at) : "log a check-in"} href="/portal/progress" />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card title={`Today · ${DAY_NAMES[todayIdx]}`} className="md:col-span-2">{todays.length === 0 ? <Empty>No meals planned today.</Empty> : <ul className="divide-y divide-line">{todays.map((i) => <li key={i.id} className="py-2 flex justify-between gap-3"><div><div className="kicker capitalize"><CategoryDot category={i.slot} /> {i.slot}</div><div className="font-medium">{i.meal.name}</div></div><div className="text-xs text-ink-2 text-right">{i.meal.nutrition.kcal} kcal<br />{i.meal.nutrition.protein} g protein</div></li>)}</ul>}{plan && plan.plan.status === "proposed" && <Link href="/portal/plan" className="btn-primary btn-sm mt-3">Review & approve your plan</Link>}</Card>
        <Card title="Daily targets" kicker="Estimates">{t.calories_target ? <div className="flex justify-around"><Ring value={kcalToday} max={t.calories_target} label={`${kcalToday}/${t.calories_target} kcal`} /><Ring value={proteinToday} max={t.protein_g ?? 1} label={`${Math.round(proteinToday)}/${t.protein_g} g protein`} color="#eb6834" /></div> : <Empty>Complete your profile to see targets.</Empty>}</Card>
      </div>
      <Card title="Recent orders">{orders.length === 0 ? <Empty>No orders yet.</Empty> : <table className="table"><thead><tr><th>Order</th><th>Delivery</th><th>Meals</th><th>Status</th></tr></thead><tbody>{orders.slice(0, 5).map((o) => <tr key={o.id}><td>{o.order_number}</td><td>{fmtDate(o.delivery_date)}</td><td>{o.meals}</td><td><StatusBadge status={o.status} /></td></tr>)}</tbody></table>}</Card>
    </div>
  );
}
