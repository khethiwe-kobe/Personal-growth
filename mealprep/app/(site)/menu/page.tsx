import Link from "next/link";
import type { Metadata } from "next";
import { MENU_CATEGORIES, TAG_LABELS, publicMenu } from "@/lib/site";
import { CtaBand, MealCard } from "@/components/site/parts";

export const metadata: Metadata = { title: "Menu" };

const FILTER_TAGS = ["high_protein", "lower_carb", "vegetarian", "vegan", "pescatarian", "gluten_free", "dairy_free"];

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ diet?: string; cat?: string }> }) {
  const { diet, cat } = await searchParams;
  const all = publicMenu();
  const meals = all.filter((m) => (!diet || m.tags.includes(diet)) && (!cat || m.category === cat));
  const cats = MENU_CATEGORIES.filter((c) => all.some((m) => m.category === c));
  const href = (next: { diet?: string; cat?: string }) => {
    const p = new URLSearchParams();
    const d = "diet" in next ? next.diet : diet;
    const c = "cat" in next ? next.cat : cat;
    if (d) p.set("diet", d);
    if (c) p.set("cat", c);
    const qs = p.toString();
    return qs ? `/menu?${qs}` : "/menu";
  };
  const chip = (active: boolean) => `badge !text-sm !px-3.5 !py-1.5 border transition-colors ${active ? "bg-ink text-white border-ink" : "bg-white text-ink-2 border-line hover:border-ink-3"}`;

  return (
    <>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-8">
        <div className="kicker mb-3">The menu</div>
        <h1 className="text-4xl sm:text-5xl leading-tight max-w-3xl">Every dish, with the numbers that matter.</h1>
        <p className="mt-4 text-ink-2 max-w-2xl leading-relaxed">Nutrition per portion is calculated from each recipe&apos;s ingredients. Your own plan picks from this menu and adjusts portions to your targets.</p>
        <div className="mt-8 space-y-3">
          <div className="flex flex-wrap gap-2"><Link href={href({ cat: undefined })} className={chip(!cat)}>All meals</Link>{cats.map((c) => <Link key={c} href={href({ cat: c })} className={`${chip(cat === c)} capitalize`}>{c}</Link>)}</div>
          <div className="flex flex-wrap gap-2"><Link href={href({ diet: undefined })} className={chip(!diet)}>Any diet</Link>{FILTER_TAGS.map((t) => <Link key={t} href={href({ diet: t })} className={chip(diet === t)}>{TAG_LABELS[t]}</Link>)}</div>
        </div>
      </section>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <div className="text-sm text-ink-3 mb-4">{meals.length} {meals.length === 1 ? "dish" : "dishes"}</div>
        {meals.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{meals.map((m) => <MealCard key={m.id} meal={m} />)}</div>
        ) : (
          <div className="card p-10 text-center text-ink-2">Nothing matches that combination yet. <Link href="/menu" className="text-accent font-medium">Clear filters</Link></div>
        )}
        <p className="mt-10 text-xs text-ink-3 max-w-3xl">Prices are per portion when ordered individually; plans bring the per-meal price down. Allergens listed are those present in the recipe ingredients. Our kitchen handles common allergens, so tell us about severe allergies during your assessment.</p>
      </section>
      <CtaBand title="Want this matched to your macros?" body="Tell us your goal and we'll build a week from this menu, portioned to you." primary={["Build my plan", "/onboard"]} secondary={["See plans & pricing", "/plans"]} />
    </>
  );
}
