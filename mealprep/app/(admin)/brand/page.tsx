import { requirePermission } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { BRAND_NAMES, TAGLINES, BRAND_IDENTITY } from "@/lib/business";

export default async function Brand({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requirePermission("business:view");
  const { cat } = await searchParams;
  const cats = [...new Set(BRAND_NAMES.map((b) => b.category))];
  const names = BRAND_NAMES.filter((b) => !cat || b.category === cat);
  return (
    <div>
      <PageHeader kicker="Identity" title="Brand name, taglines & identity">Names marked “verify” are common words or close to existing businesses — check CIPC, trademark (CIPC IP) and domain availability (.co.za and .com) before committing to any name.</PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title={`${names.length} name ideas`} className="lg:col-span-2" action={<div className="flex gap-1 flex-wrap"><a href="/brand" className={`badge ${!cat ? "bg-ink text-white" : "bg-bone-2"}`}>all</a>{cats.map((c) => <a key={c} href={`/brand?cat=${c}`} className={`badge ${cat === c ? "bg-ink text-white" : "bg-bone-2"}`}>{c}</a>)}</div>}>
          <table className="table"><thead><tr><th>Name</th><th>Meaning</th><th>Positioning</th><th>Tagline</th><th></th></tr></thead><tbody>{names.map((b) => <tr key={b.name}><td className="font-display text-base">{b.name}</td><td className="text-xs text-ink-2">{b.meaning}</td><td className="text-xs text-ink-2">{b.positioning}</td><td className="text-xs italic">“{b.tagline}”</td><td>{b.check && <span className="badge bg-amber-100 text-amber-900">verify</span>}</td></tr>)}</tbody></table>
        </Card>
        <div className="space-y-4">
          <Card title="Taglines"><ul className="text-sm space-y-1">{TAGLINES.map((t) => <li key={t} className="italic">“{t}”</li>)}</ul></Card>
        </div>
        <Card title="Premium brand identity" className="lg:col-span-3">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div><div className="kicker">Logo direction</div><p>{BRAND_IDENTITY.logo}</p><div className="kicker mt-3">Typography</div><p>Display: {BRAND_IDENTITY.typography.display}. Body: {BRAND_IDENTITY.typography.body}. {BRAND_IDENTITY.typography.data}.</p><div className="kicker mt-3">Packaging</div><p>{BRAND_IDENTITY.packaging}</p></div>
            <div><div className="kicker">Colour palette</div><div className="grid grid-cols-2 gap-2 mt-1">{BRAND_IDENTITY.palette.map((p) => <div key={p.hex} className="flex items-center gap-2"><span className="w-8 h-8 rounded-lg border border-line" style={{ background: p.hex }} /><div><div className="font-medium">{p.name} <span className="text-ink-3 font-mono text-xs">{p.hex}</span></div><div className="text-xs text-ink-2">{p.use}</div></div></div>)}</div><div className="kicker mt-3">Photography</div><p>{BRAND_IDENTITY.photography}</p><div className="kicker mt-3">Website & app</div><p>{BRAND_IDENTITY.website} {BRAND_IDENTITY.app}</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
