import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { mealProfiles, listMeals } from "@/lib/repo/meals";
import { PageHeader, Card, CategoryBadge, NutritionRow, Rating, Empty } from "@/components/ui";
import { formatZar } from "@/lib/costing";
import { MEAL_CATEGORIES } from "@/lib/types";
import { prettyTag } from "@/lib/recommend";

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; tag?: string }> }) {
  await requirePermission("meals:view");
  const { category, q, tag } = await searchParams;
  const rows = listMeals(false);
  const profiles = new Map(mealProfiles().map((m) => [m.id, m]));
  const filtered = rows.filter((m) => (!category || m.category === category) && (!q || m.name.toLowerCase().includes(q.toLowerCase())) && (!tag || (profiles.get(m.id)?.dietary_tags ?? []).includes(tag)));
  return (
    <div>
      <PageHeader kicker="Meal database" title="Meals & recipes" actions={<Link href="/meals/new" className="btn-primary">New meal</Link>}>Nutrition and cost are derived from each recipe’s ingredients, so labels, plans and pricing never drift.</PageHeader>
      <Card>
        <form className="flex flex-wrap gap-2 mb-4">
          <input name="q" defaultValue={q ?? ""} placeholder="Search meals" className="input max-w-xs" />
          <select name="category" defaultValue={category ?? ""} className="input max-w-[160px]"><option value="">All categories</option>{MEAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <select name="tag" defaultValue={tag ?? ""} className="input max-w-[180px]"><option value="">Any dietary tag</option>{["high_protein", "lower_carb", "vegetarian", "vegan", "gluten_free", "dairy_free", "pescatarian", "halal"].map((t) => <option key={t} value={t}>{prettyTag(t)}</option>)}</select>
          <button className="btn-secondary">Filter</button>
        </form>
        {filtered.length === 0 ? <Empty>No meals match.</Empty> : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((m) => { const p = profiles.get(m.id); return (
              <Link key={m.id} href={`/meals/${m.id}`} className={`rounded-xl border border-line p-4 hover:border-accent transition-colors ${m.is_active ? "" : "opacity-60"}`}>
                <div className="flex justify-between items-start gap-2"><div className="font-medium">{m.name}</div><CategoryBadge category={m.category} /></div>
                <div className="text-xs text-ink-2 mt-1 line-clamp-2">{m.description}</div>
                {p && <div className="mt-2"><NutritionRow n={p.nutrition} compact /></div>}
                <div className="flex justify-between items-center mt-2 text-xs text-ink-2"><span>{formatZar(m.selling_price)} · cost {p ? formatZar(p.cost) : "—"} · <b className="text-ink">{p && m.selling_price ? Math.round(((m.selling_price - p.cost) / m.selling_price) * 100) : "—"}%</b> margin</span><Rating value={p?.avg_rating} /></div>
                <div className="flex flex-wrap gap-1 mt-2">{(p?.dietary_tags ?? []).map((t) => <span key={t} className="badge bg-bone-2 text-ink-2">{prettyTag(t)}</span>)}{(p?.allergens ?? []).map((a) => <span key={a} className="badge bg-rose-50 text-rose-900">{a}</span>)}</div>
              </Link>); })}
          </div>
        )}
      </Card>
    </div>
  );
}
