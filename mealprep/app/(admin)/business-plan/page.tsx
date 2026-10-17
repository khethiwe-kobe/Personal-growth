import { requirePermission } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { VALUE_PROPOSITIONS, TARGET_SEGMENTS, REVENUE_STREAMS, FUTURE_AI } from "@/lib/business";
import { AUTOMATION_CATALOGUE } from "@/lib/automation";
import { getSetting } from "@/lib/db";

export default async function BusinessPlan() {
  await requirePermission("business:view");
  return (
    <div>
      <PageHeader kicker="Strategy" title="Business plan">A premium personalised meal-prep service, run from one connected system.</PageHeader>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Business concept"><p className="text-sm">{getSetting("brand_name")} prepares meals built around each client’s nutrition profile, goals and preferences, cooks them in bulk with tight cost control, and delivers them with premium packaging. Clients subscribe weekly; the business compounds through retention, referrals and corporate accounts.</p><div className="kicker mt-4 mb-1">Value propositions</div><ul className="text-sm list-disc pl-5 space-y-1">{VALUE_PROPOSITIONS.map((v) => <li key={v}>{v}</li>)}</ul></Card>
        <Card title="Target customers"><table className="table"><thead><tr><th>Segment</th><th>Need</th><th>Angle</th></tr></thead><tbody>{TARGET_SEGMENTS.map((s) => <tr key={s.segment}><td className="font-medium">{s.segment}</td><td className="text-xs text-ink-2">{s.need}</td><td className="text-xs text-ink-2">{s.angle}</td></tr>)}</tbody></table></Card>
        <Card title="Revenue model" kicker="13 streams"><ol className="text-sm list-decimal pl-5 grid sm:grid-cols-2 gap-x-4 gap-y-1">{REVENUE_STREAMS.map((r) => <li key={r}>{r}</li>)}</ol><p className="text-xs text-ink-2 mt-3">Start with streams 1–4 (meals, weekly packages, subscriptions, custom plans). Add family and corporate once production is stable; partnerships and events once brand is established.</p></Card>
        <Card title="Scaling the same system" kicker="10 → 100 → 1,000 clients">
          <table className="table"><tbody>
            <tr><td className="font-medium">10 clients</td><td className="text-xs text-ink-2">One owner-operator. Single kitchen, SQLite, manual purchasing from the grocery list, labels printed from the browser. Everything in this app works unchanged.</td></tr>
            <tr><td className="font-medium">100 clients</td><td className="text-xs text-ink-2">Two cooks, a packer and a driver, each with their own role. Postgres, WhatsApp automation live, PayFast webhooks, purchase orders sent to suppliers, kitchen capacity planning daily. Subscriptions carry most revenue.</td></tr>
            <tr><td className="font-medium">1,000 clients</td><td className="text-xs text-ink-2">Multiple kitchens (locations table), demand forecasting drives purchasing, route optimisation, corporate accounts, a dietitian partner reviewing flagged profiles, analytics exported to a warehouse. Domain modules become services behind the same API.</td></tr>
          </tbody></table>
        </Card>
        <Card title="Automation opportunities" className="lg:col-span-2"><table className="table"><thead><tr><th>Trigger</th><th>Automated action</th><th>Status</th></tr></thead><tbody>{AUTOMATION_CATALOGUE.map((a) => <tr key={a.trigger}><td className="text-sm">{a.trigger}</td><td className="text-xs text-ink-2">{a.action}</td><td><span className={`badge ${a.status === "live" ? "bg-emerald-100 text-emerald-900" : "bg-sky-100 text-sky-900"}`}>{a.status}</span></td></tr>)}</tbody></table></Card>
        <Card title="Future AI features" kicker="Architecture hooks already in place" className="lg:col-span-2"><table className="table"><thead><tr><th>Feature</th><th>Where it plugs in</th></tr></thead><tbody>{FUTURE_AI.map((f) => <tr key={f.feature}><td className="font-medium text-sm">{f.feature}</td><td className="text-xs text-ink-2 font-mono">{f.hook}</td></tr>)}</tbody></table></Card>
      </div>
    </div>
  );
}
