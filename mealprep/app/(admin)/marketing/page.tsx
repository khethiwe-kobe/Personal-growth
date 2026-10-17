import { requirePermission, can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, Field, Stat, StatusBadge, fmtDate } from "@/components/ui";
import { formatZar, formatZar0 } from "@/lib/costing";
import { CAMPAIGN_IDEAS } from "@/lib/business";
import { saveCampaignAction } from "@/app/actions";
import { BarChart } from "@/components/charts";

const CHANNELS = ["instagram", "tiktok", "facebook", "whatsapp", "email", "google", "referral", "other"];

export default async function Marketing({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requirePermission("marketing:view");
  const { edit } = await searchParams;
  const rows = getDb().prepare("SELECT * FROM marketing_campaigns ORDER BY start_date DESC").all() as { id: number; name: string; channel: string; start_date: string; end_date: string | null; spend_zar: number; leads: number; conversions: number; orders: number; revenue_zar: number; status: string; notes: string }[];
  const editing = edit ? rows.find((r) => r.id === Number(edit)) : undefined;
  const spend = rows.reduce((s, r) => s + r.spend_zar, 0), leads = rows.reduce((s, r) => s + r.leads, 0), conv = rows.reduce((s, r) => s + r.conversions, 0), rev = rows.reduce((s, r) => s + r.revenue_zar, 0);
  const byChannel = CHANNELS.map((c) => ({ c, spend: rows.filter((r) => r.channel === c).reduce((s, r) => s + r.spend_zar, 0), revenue: rows.filter((r) => r.channel === c).reduce((s, r) => s + r.revenue_zar, 0) })).filter((x) => x.spend || x.revenue);
  const sources = getDb().prepare("SELECT source, COUNT(*) AS n FROM clients WHERE source != '' GROUP BY source ORDER BY n DESC").all() as { source: string; n: number }[];
  return (
    <div>
      <PageHeader kicker="Growth" title="Marketing">Campaigns across Instagram, TikTok, Facebook, WhatsApp, email and Google with leads, conversions, orders, revenue and ROI.</PageHeader>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5"><Stat label="Spend" value={formatZar0(spend)} /><Stat label="Leads" value={leads} /><Stat label="Conversions" value={conv} sub={leads ? `${((conv / leads) * 100).toFixed(0)}% conversion` : undefined} /><Stat label="CAC" value={formatZar0(conv ? spend / conv : 0)} /><Stat label="Campaign ROI" value={spend ? `${(((rev - spend) / spend) * 100).toFixed(0)}%` : "—"} sub={`${formatZar0(rev)} attributed revenue`} tone="good" /></div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Campaigns" className="lg:col-span-2"><table className="table"><thead><tr><th>Campaign</th><th>Channel</th><th>Period</th><th>Spend</th><th>Leads</th><th>Conv.</th><th>Orders</th><th>Revenue</th><th>ROI</th><th>Status</th><th></th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td className="font-medium">{r.name}</td><td className="text-xs capitalize">{r.channel}</td><td className="text-xs">{fmtDate(r.start_date)}{r.end_date ? ` – ${fmtDate(r.end_date)}` : ""}</td><td>{formatZar(r.spend_zar)}</td><td>{r.leads}</td><td>{r.conversions}</td><td>{r.orders}</td><td>{formatZar(r.revenue_zar)}</td><td className={r.revenue_zar >= r.spend_zar ? "text-good" : "text-critical"}>{r.spend_zar ? `${(((r.revenue_zar - r.spend_zar) / r.spend_zar) * 100).toFixed(0)}%` : "—"}</td><td><StatusBadge status={r.status} /></td><td>{can(user, "marketing:edit") && <a href={`/marketing?edit=${r.id}`} className="btn-ghost btn-sm">Edit</a>}</td></tr>)}</tbody></table></Card>
        {can(user, "marketing:edit") && <Card title={editing ? "Edit campaign" : "New campaign"}><form action={saveCampaignAction} className="grid grid-cols-2 gap-2">{editing && <input type="hidden" name="id" value={editing.id} />}<Field label="Name" className="col-span-2"><input name="name" defaultValue={editing?.name ?? ""} className="input" required /></Field><Field label="Channel"><select name="channel" defaultValue={editing?.channel ?? "instagram"} className="input">{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Status"><select name="status" defaultValue={editing?.status ?? "active"} className="input">{["planned", "active", "paused", "completed"].map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Start"><input name="start_date" type="date" defaultValue={editing?.start_date ?? ""} className="input" /></Field><Field label="End"><input name="end_date" type="date" defaultValue={editing?.end_date ?? ""} className="input" /></Field><Field label="Spend (R)"><input name="spend_zar" type="number" defaultValue={editing?.spend_zar ?? 0} className="input" /></Field><Field label="Leads"><input name="leads" type="number" defaultValue={editing?.leads ?? 0} className="input" /></Field><Field label="Conversions"><input name="conversions" type="number" defaultValue={editing?.conversions ?? 0} className="input" /></Field><Field label="Orders"><input name="orders" type="number" defaultValue={editing?.orders ?? 0} className="input" /></Field><Field label="Revenue (R)" className="col-span-2"><input name="revenue_zar" type="number" defaultValue={editing?.revenue_zar ?? 0} className="input" /></Field><Field label="Notes" className="col-span-2"><input name="notes" defaultValue={editing?.notes ?? ""} className="input" /></Field><div className="flex gap-2"><button className="btn-primary btn-sm">Save</button>{editing && <a href="/marketing" className="btn-secondary btn-sm">New</a>}</div></form></Card>}
        <Card title="Spend vs revenue by channel">{byChannel.length ? <BarChart labels={byChannel.map((x) => x.c)} series={[{ name: "Spend", values: byChannel.map((x) => x.spend) }, { name: "Revenue", values: byChannel.map((x) => x.revenue) }]} unit="R" height={180} /> : <div className="text-sm text-ink-3">No campaigns yet.</div>}</Card>
        <Card title="Where clients come from" kicker="Acquisition source on profiles"><table className="table"><tbody>{sources.map((s) => <tr key={s.source}><td className="capitalize">{s.source}</td><td className="text-right">{s.n}</td></tr>)}</tbody></table></Card>
        <Card title="Campaign ideas"><ul className="text-sm space-y-2">{CAMPAIGN_IDEAS.map((c) => <li key={c.name}><b>{c.name}</b><div className="text-xs text-ink-2">{c.audience} · {c.offer} · {c.channel}</div></li>)}</ul></Card>
      </div>
    </div>
  );
}
