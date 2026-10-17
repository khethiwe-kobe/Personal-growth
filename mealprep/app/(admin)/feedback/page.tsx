import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { listFeedback, feedbackInsights } from "@/lib/repo/orders";
import { PageHeader, Card, fmtDate, Empty, Stat, Rating } from "@/components/ui";
import { BarChart } from "@/components/charts";

export default async function Feedback() {
  await requirePermission("clients:view");
  const rows = listFeedback(100);
  const ins = feedbackInsights();
  const dims = ["taste", "portion", "presentation", "variety", "packaging", "overall"] as const;
  return (
    <div>
      <PageHeader kicker="Voice of the client" title="Feedback">After every delivery clients rate taste, portion size, presentation, variety, packaging and overall satisfaction (1–5).</PageHeader>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">{dims.map((d) => <Stat key={d} label={d} value={ins.avg[d] ? ins.avg[d]!.toFixed(2) : "—"} sub={d === "overall" ? `${ins.avg.n} ratings` : undefined} />)}</div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Rating by dimension" className="lg:col-span-2"><BarChart labels={dims.map((d) => d)} series={[{ name: "Average", values: dims.map((d) => Math.round((ins.avg[d] ?? 0) * 100) / 100) }]} height={160} /></Card>
        <Card title="Actions" kicker="Derived from ratings">
          <div className="kicker mb-1 text-good">Promote</div>{ins.promote.length ? <ul className="text-sm">{ins.promote.map((m) => <li key={m.id}><Link href={`/meals/${m.id}`} className="hover:underline">{m.name}</Link> <Rating value={m.overall} /> <span className="text-xs text-ink-3">({m.n})</span></li>)}</ul> : <div className="text-xs text-ink-3">Nothing qualifies yet (≥ 4.3, ≥ 2 reviews).</div>}
          <div className="kicker mb-1 mt-3 text-critical">Review or remove</div>{ins.remove.length ? <ul className="text-sm">{ins.remove.map((m) => <li key={m.id}><Link href={`/meals/${m.id}`} className="hover:underline">{m.name}</Link> <Rating value={m.overall} /> <span className="text-xs text-ink-3">({m.n})</span></li>)}</ul> : <div className="text-xs text-ink-3">No meals rated ≤ 2.8.</div>}
        </Card>
        <Card title="Meal ratings" className="lg:col-span-3">{ins.byMeal.length === 0 ? <Empty>No ratings yet.</Empty> : <table className="table"><thead><tr><th>Meal</th><th>Reviews</th>{dims.map((d) => <th key={d}>{d}</th>)}</tr></thead><tbody>{ins.byMeal.map((m) => <tr key={m.id}><td className="font-medium"><Link href={`/meals/${m.id}`} className="hover:underline">{m.name}</Link></td><td>{m.n}</td>{dims.map((d) => <td key={d} className={d === "overall" ? "font-medium" : ""}>{m[d]?.toFixed(1)}</td>)}</tr>)}</tbody></table>}</Card>
        <Card title="Recent comments" className="lg:col-span-3">{rows.length === 0 ? <Empty>No feedback yet.</Empty> : <ul className="divide-y divide-line text-sm">{rows.filter((r) => r.comment).slice(0, 30).map((r) => <li key={r.id} className="py-2 flex justify-between gap-4"><div><Rating value={r.overall} /> <b>{r.client_name}</b> on {r.meal_name ?? "order"}: <span className="text-ink-2">{r.comment}</span></div><span className="text-[11px] text-ink-3 whitespace-nowrap">{fmtDate(r.created_at)}</span></li>)}</ul>}</Card>
      </div>
    </div>
  );
}
