import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMealFull } from "@/lib/repo/meals";
import { formatZar0 } from "@/lib/costing";
import { ALLERGEN_LABELS } from "@/lib/types";
import { publicMenu } from "@/lib/site";
import { MealCard, Stars, TagList } from "@/components/site/parts";

/** Active meals only — retired dishes are not public. */
function load(id: string) {
  const m = getMealFull(Number(id));
  return m && m.meal.is_active ? m : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = load((await params).id);
  return m ? { title: m.meal.name, description: m.meal.description } : {};
}

const BAND: Record<string, string> = { breakfast: "bg-cat-breakfast", lunch: "bg-cat-lunch", dinner: "bg-cat-dinner", snack: "bg-cat-snack", dessert: "bg-cat-snack", drink: "bg-sage" };

export default async function MealDetail({ params }: { params: Promise<{ id: string }> }) {
  const m = load((await params).id);
  if (!m) notFound();
  const n = m.nutrition;
  const more = publicMenu().filter((x) => x.category === m.meal.category && x.id !== m.meal.id).slice(0, 3);
  const rows: [string, string][] = [["Energy", `${Math.round(n.kcal)} kcal`], ["Protein", `${n.protein.toFixed(1)} g`], ["Carbohydrate", `${n.carbs.toFixed(1)} g`], ["of which sugars", `${n.sugar.toFixed(1)} g`], ["Fat", `${n.fat.toFixed(1)} g`], ["Fibre", `${n.fibre.toFixed(1)} g`], ["Sodium", `${Math.round(n.sodium_mg)} mg`]];

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-16">
        <Link href="/menu" className="text-sm text-ink-3 hover:text-ink">← Back to the menu</Link>
        <div className="mt-6 grid lg:grid-cols-[1.3fr_1fr] gap-10 items-start">
          <div>
            <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${BAND[m.meal.category] ?? "bg-sage"}`} /><span className="kicker capitalize">{m.meal.category}{m.meal.cuisine && ` · ${m.meal.cuisine}`}</span></div>
            <h1 className="text-4xl sm:text-5xl leading-tight mt-3">{m.meal.name}</h1>
            <p className="mt-4 text-lg text-ink-2 leading-relaxed">{m.meal.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <span className="font-display text-3xl">{formatZar0(m.meal.selling_price)}</span>
              {m.rating.avg != null && m.rating.avg >= 4 && m.rating.count >= 5 && <span className="text-sm text-ink-2 flex items-center gap-1.5"><Stars value={m.rating.avg} /> {m.rating.avg.toFixed(1)} · {m.rating.count} ratings</span>}
            </div>
            <div className="mt-4"><TagList tags={m.tags} max={8} /></div>
            <div className="mt-10 grid sm:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl mb-2">Ingredients</h2>
                <p className="text-sm text-ink-2 leading-relaxed">{m.lines.map((l) => l.ingredient.name).join(", ")}.</p>
                <p className="text-sm mt-3"><b>Allergens:</b> {m.allergens.length ? m.allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(", ") : "none declared in the recipe"}</p>
              </div>
              <div>
                <h2 className="text-xl mb-2">Storage & reheating</h2>
                <p className="text-sm text-ink-2 leading-relaxed">{m.meal.storage} Best within {m.meal.shelf_life_days} days of preparation.</p>
                <p className="text-sm text-ink-2 leading-relaxed mt-2">{m.meal.reheating}</p>
              </div>
            </div>
          </div>
          <aside className="card p-6 lg:sticky lg:top-24">
            <div className="kicker mb-1">Nutrition per portion</div>
            <div className="text-xs text-ink-3 mb-4">Standard {Math.round(m.meal.serving_size_g)} g portion. Your plan may scale it to your targets.</div>
            <table className="w-full text-sm"><tbody>{rows.map(([a, b]) => <tr key={a} className="border-b border-line/70 last:border-0"><td className={`py-2 ${a.startsWith("of") ? "pl-4 text-ink-3" : "text-ink-2"}`}>{a}</td><td className="py-2 text-right font-medium">{b}</td></tr>)}</tbody></table>
            <Link href="/onboard" className="btn-primary w-full mt-6">Add to my plan</Link>
            <p className="text-[11px] text-ink-3 mt-3">Values are estimates from recipe ingredients, not medical advice.</p>
          </aside>
        </div>
      </section>
      {more.length > 0 && (
        <section className="bg-white border-t border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <h2 className="text-2xl mb-6">More <span className="capitalize">{m.meal.category}</span> dishes</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{more.map((x) => <MealCard key={x.id} meal={x} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}
