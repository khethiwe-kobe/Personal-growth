import Link from "next/link";
import type { ReactNode } from "react";
import { formatZar0 } from "@/lib/costing";
import { ALLERGEN_LABELS } from "@/lib/types";
import { TAG_LABELS, type PublicMeal, type PublicPackage } from "@/lib/site";

/** Building blocks shared by the public website pages. */

const BAND: Record<string, string> = { breakfast: "bg-cat-breakfast", lunch: "bg-cat-lunch", dinner: "bg-cat-dinner", snack: "bg-cat-snack", dessert: "bg-cat-snack", drink: "bg-sage" };

export function Section({ id, kicker, title, intro, children, className = "", tone = "bone" }: { id?: string; kicker?: string; title?: ReactNode; intro?: ReactNode; children: ReactNode; className?: string; tone?: "bone" | "white" | "ink" }) {
  const bg = tone === "ink" ? "bg-ink text-bone" : tone === "white" ? "bg-white" : "";
  return (
    <section id={id} className={`${bg} ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        {(kicker || title) && (
          <div className="max-w-2xl mb-10">
            {kicker && <div className={`kicker mb-3 ${tone === "ink" ? "!text-bone/60" : ""}`}>{kicker}</div>}
            {title && <h2 className="text-3xl sm:text-4xl leading-tight">{title}</h2>}
            {intro && <p className={`mt-4 text-base leading-relaxed ${tone === "ink" ? "text-bone/75" : "text-ink-2"}`}>{intro}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function Macros({ n, light = false }: { n: { kcal: number; protein: number; carbs: number; fat: number }; light?: boolean }) {
  const items: [string, string][] = [["kcal", String(Math.round(n.kcal))], ["protein", `${Math.round(n.protein)}g`], ["carbs", `${Math.round(n.carbs)}g`], ["fat", `${Math.round(n.fat)}g`]];
  return (
    <dl className="grid grid-cols-4 gap-1 text-center">
      {items.map(([k, v]) => (
        <div key={k} className={`rounded-lg py-1.5 ${light ? "bg-white/10" : "bg-bone"}`}>
          <dd className="text-sm font-semibold">{v}</dd>
          <dt className={`text-[10px] uppercase tracking-wide ${light ? "text-bone/60" : "text-ink-3"}`}>{k}</dt>
        </div>
      ))}
    </dl>
  );
}

export function TagList({ tags, max = 3 }: { tags: string[]; max?: number }) {
  const shown = tags.filter((t) => TAG_LABELS[t]).slice(0, max);
  if (!shown.length) return null;
  return <div className="flex flex-wrap gap-1">{shown.map((t) => <span key={t} className="badge bg-bone-2 text-ink-2">{TAG_LABELS[t]}</span>)}</div>;
}

export function MealCard({ meal }: { meal: PublicMeal }) {
  return (
    <Link href={`/menu/${meal.id}`} className="group card overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className={`h-1.5 ${BAND[meal.category] ?? "bg-sage"}`} />
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="kicker capitalize">{meal.category}{meal.cuisine && ` · ${meal.cuisine}`}</div>
            <h3 className="text-lg leading-snug mt-1 group-hover:text-accent transition-colors">{meal.name}</h3>
          </div>
          <div className="text-sm font-medium whitespace-nowrap">{formatZar0(meal.price)}</div>
        </div>
        <p className="text-sm text-ink-2 leading-relaxed line-clamp-2">{meal.description}</p>
        <div className="mt-auto space-y-3">
          <TagList tags={meal.tags} />
          <Macros n={meal.nutrition} />
          {meal.allergens.length > 0 && <div className="text-[11px] text-ink-3">Contains: {meal.allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(", ")}</div>}
        </div>
      </div>
    </Link>
  );
}

export function PlanCard({ p, cta }: { p: PublicPackage; cta: string }) {
  return (
    <div className={`relative rounded-2xl border p-6 flex flex-col ${p.popular ? "bg-ink text-bone border-ink shadow-lg" : "bg-white border-line"}`}>
      {p.popular && <span className="absolute -top-3 left-6 badge bg-accent text-white !text-xs !px-3 !py-1">Most popular</span>}
      <div className={`kicker ${p.popular ? "!text-bone/60" : ""}`}>{p.custom ? "Tailored" : `${p.meals_per_week} meals / week`}</div>
      <h3 className="text-2xl mt-1">{p.name}</h3>
      <p className={`text-sm mt-2 leading-relaxed ${p.popular ? "text-bone/75" : "text-ink-2"}`}>{p.description}</p>
      <div className="mt-6">
        {p.custom ? (
          <><span className="text-sm">from </span><span className="font-display text-4xl">{formatZar0(p.price)}</span><span className="text-sm"> / week</span></>
        ) : (
          <><span className="font-display text-4xl">{formatZar0(p.per_meal)}</span><span className="text-sm"> / meal</span></>
        )}
        <div className={`text-xs mt-1 ${p.popular ? "text-bone/60" : "text-ink-3"}`}>{p.custom ? "Quoted after your assessment" : `${formatZar0(p.price)} per week, billed weekly, bi-weekly or monthly`}</div>
      </div>
      <Link href="/onboard" className={`mt-6 w-full ${p.popular ? "btn-primary" : "btn-secondary"}`}>{cta}</Link>
    </div>
  );
}

export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value);
  return <span className={`text-accent tracking-tight ${className}`} aria-label={`${value.toFixed(1)} out of 5`}>{"★★★★★".slice(0, full)}<span className="text-line">{"★★★★★".slice(full)}</span></span>;
}

export function Faq({ items }: { items: [string, ReactNode][] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map(([q, a]) => (
        <details key={q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
            {q}
            <span className="text-ink-3 text-xl leading-none transition-transform group-open:rotate-45" aria-hidden>+</span>
          </summary>
          <div className="mt-3 text-sm text-ink-2 leading-relaxed max-w-3xl">{a}</div>
        </details>
      ))}
    </div>
  );
}

export function CtaBand({ title, body, primary, secondary }: { title: string; body: string; primary: [string, string]; secondary?: [string, string] }) {
  return (
    <section className="bg-accent text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="max-w-xl"><h2 className="text-3xl sm:text-4xl leading-tight">{title}</h2><p className="mt-3 text-white/80">{body}</p></div>
        <div className="flex flex-wrap gap-3">
          <Link href={primary[1]} className="btn bg-white text-ink hover:bg-bone !px-6 !py-3 !text-base">{primary[0]}</Link>
          {secondary && <Link href={secondary[1]} className="btn border border-white/40 text-white hover:bg-white/10 !px-6 !py-3 !text-base">{secondary[0]}</Link>}
        </div>
      </div>
    </section>
  );
}
