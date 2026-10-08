import { requireClient } from "@/lib/auth";
import { listSubscriptions, subscriptionEvents, listPackages } from "@/lib/repo/orders";
import { Card, StatusBadge, fmtDate, Empty } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { subscriptionActionForm } from "@/app/actions";

export default async function Subscription() {
  const user = await requireClient();
  const subs = listSubscriptions(user.client_id);
  const active = subs.find((s) => s.status !== "cancelled");
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">My subscription</h1>
      {!active ? <Card><Empty>You don’t have a subscription. Packages:</Empty><div className="grid sm:grid-cols-3 gap-2">{listPackages().map((p) => <div key={p.id} className="rounded-xl border border-line p-3"><div className="font-medium">{p.name}</div><div className="text-xs text-ink-2">{p.description}</div><div className="text-sm mt-1">{p.meals_per_week} meals · {formatZar(p.price_zar)}/week</div></div>)}</div><p className="text-xs text-ink-2 mt-3">Ask your planner to activate a package.</p></Card> : (
        <Card title={active.package_name ?? "Custom package"} kicker={<StatusBadge status={active.status} />}>
          <div className="grid sm:grid-cols-4 gap-3 text-sm"><div><div className="kicker">Meals per week</div>{active.meals_per_week}</div><div><div className="kicker">Billing</div>{active.frequency} · {formatZar(active.price_per_cycle)}</div><div><div className="kicker">Started</div>{fmtDate(active.start_date)}</div><div><div className="kicker">Next renewal</div>{fmtDate(active.renewal_date)}</div></div>
          <div className="flex gap-2 mt-4 flex-wrap">{(["skip", active.status === "paused" ? "resume" : "pause", "cancel"] as const).map((a) => <form key={a} action={subscriptionActionForm}><input type="hidden" name="subscription_id" value={active.id} /><input type="hidden" name="action" value={a} /><button className={a === "cancel" ? "btn-secondary !text-critical" : "btn-secondary"}>{a === "skip" ? "Skip next week" : a === "pause" ? "Pause" : a === "resume" ? "Resume" : "Cancel subscription"}</button></form>)}</div>
          <div className="kicker mt-5 mb-1">History</div><ul className="text-xs text-ink-2 space-y-0.5">{subscriptionEvents(active.id).map((e) => <li key={e.id}>{fmtDate(e.created_at)} · {e.event_type}{e.week_start ? ` (week of ${fmtDate(e.week_start)})` : ""}</li>)}</ul>
        </Card>
      )}
    </div>
  );
}
