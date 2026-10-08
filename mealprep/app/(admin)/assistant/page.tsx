import { requirePermission } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { ask, EXAMPLE_QUESTIONS } from "@/lib/assistant";
import Link from "next/link";

export default async function Assistant({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("assistant:use");
  const { q } = await searchParams;
  const answer = q ? ask(q) : null;
  return (
    <div className="max-w-4xl">
      <PageHeader kicker="Business assistant" title="Ask the business">Answers come from live application data: orders, inventory, suppliers, feedback and finance. No figures are invented.</PageHeader>
      <Card>
        <form className="flex gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="e.g. How much chicken do I need next week?" className="input" autoFocus />
          <button className="btn-primary">Ask</button>
        </form>
        <div className="flex flex-wrap gap-1.5 mt-3">{EXAMPLE_QUESTIONS.map((e) => <Link key={e} href={`/assistant?q=${encodeURIComponent(e)}`} className="badge bg-bone-2 text-ink-2 hover:bg-bone">{e}</Link>)}</div>
      </Card>
      {answer && (
        <Card title={answer.title} className="mt-4" action={answer.link ? <Link href={answer.link} className="btn-secondary btn-sm">Open</Link> : undefined}>
          <p className="text-sm">{answer.text}</p>
          {answer.table && answer.table.rows.length > 0 && (
            <table className="table mt-3"><thead><tr>{answer.table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{answer.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
          )}
        </Card>
      )}
    </div>
  );
}
