import { requirePermission } from "@/lib/auth";
import { PageHeader, Card, StatusBadge, fmtDate, Empty } from "@/components/ui";
import { AUTOMATION_CATALOGUE, listEvents } from "@/lib/automation";
import { listQueued, INTEGRATION_POINTS, TEMPLATES } from "@/lib/comms";
import { runChecksAction, dispatchQueuedAction } from "@/app/actions";

export default async function Automations({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePermission("settings:edit");
  const { tab = "rules" } = await searchParams;
  const events = listEvents(80);
  const queued = listQueued(100);
  return (
    <div>
      <PageHeader kicker="Automation" title="Automations & communication" actions={<><form action={runChecksAction}><button className="btn-secondary btn-sm">Run scheduled checks now</button></form><form action={dispatchQueuedAction}><button className="btn-secondary btn-sm">Dispatch queued messages</button></form></>}>Every business event flows through one event bus; handlers queue messages, notify staff and POST to your webhook URL for Make.com / Zapier / n8n.</PageHeader>
      <nav className="flex gap-1 border-b border-line mb-4">{[["rules", "Rules"], ["events", "Event log"], ["messages", "Message queue"], ["templates", "Templates"], ["integrations", "Integrations"]].map(([k, l]) => <a key={k} href={`/automations?tab=${k}`} className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === k ? "border-accent font-medium" : "border-transparent text-ink-2"}`}>{l}</a>)}</nav>
      {tab === "rules" && <Card><table className="table"><thead><tr><th>Trigger</th><th>Action</th><th>Status</th></tr></thead><tbody>{AUTOMATION_CATALOGUE.map((a) => <tr key={a.trigger}><td className="text-sm">{a.trigger}</td><td className="text-xs text-ink-2">{a.action}</td><td><span className={`badge ${a.status === "live" ? "bg-emerald-100 text-emerald-900" : "bg-sky-100 text-sky-900"}`}>{a.status}</span></td></tr>)}</tbody></table><p className="text-xs text-ink-2 mt-3">Scheduled checks (low stock, expiry, renewals) run when you press the button above; in production call <code>runScheduledChecks()</code> from a cron job or the webhook consumer every hour.</p></Card>}
      {tab === "events" && <Card>{events.length === 0 ? <Empty>No events yet.</Empty> : <table className="table"><thead><tr><th>When</th><th>Event</th><th>Payload</th><th>Handlers</th><th>Webhook</th></tr></thead><tbody>{events.map((e) => <tr key={e.id}><td className="text-xs">{fmtDate(e.created_at)}</td><td className="font-mono text-xs">{e.event_type}</td><td className="text-[11px] text-ink-2 font-mono max-w-md truncate">{e.payload_json}</td><td className="text-xs">{JSON.parse(e.handled_json).join(", ")}</td><td><StatusBadge status={e.webhook_status === "none" ? "skipped" : e.webhook_status} /></td></tr>)}</tbody></table>}</Card>}
      {tab === "messages" && <Card>{queued.length === 0 ? <Empty>No messages.</Empty> : <table className="table"><thead><tr><th>When</th><th>Client</th><th>Channel</th><th>Template</th><th>Body</th><th>Status</th></tr></thead><tbody>{queued.map((m) => <tr key={m.id}><td className="text-xs">{fmtDate(m.created_at)}</td><td>{m.first_name} {m.last_name}</td><td className="text-xs">{m.channel}</td><td className="text-xs">{m.template.replace(/_/g, " ")}</td><td className="text-xs text-ink-2 max-w-md">{m.body}</td><td><StatusBadge status={m.status} /></td></tr>)}</tbody></table>}</Card>}
      {tab === "templates" && <Card><table className="table"><thead><tr><th>Template</th><th>Channel</th><th>Subject</th><th>Body</th></tr></thead><tbody>{Object.entries(TEMPLATES).map(([k, t]) => <tr key={k}><td className="font-mono text-xs">{k}</td><td className="text-xs">{t.channel}</td><td className="text-xs">{t.subject}</td><td className="text-xs text-ink-2">{t.body}</td></tr>)}</tbody></table><p className="text-xs text-ink-2 mt-2">Variables: {"{{brand}} {{first_name}} {{week}} {{order}} {{total}} {{date}} {{window}}"}. Edit in <code>lib/comms.ts</code>.</p></Card>}
      {tab === "integrations" && <Card><table className="table"><thead><tr><th>Integration</th><th>How</th></tr></thead><tbody>{INTEGRATION_POINTS.map((i) => <tr key={i.name}><td className="font-medium text-sm">{i.name}</td><td className="text-xs text-ink-2">{i.how}</td></tr>)}</tbody></table></Card>}
    </div>
  );
}
