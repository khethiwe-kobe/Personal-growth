import Link from "next/link";
import { formatZar0 } from "@/lib/costing";
import { publicMenu, publicPackages, publicReviews, publicStats, siteInfo, type PublicMeal } from "@/lib/site";
import { CtaBand, Faq, Macros, MealCard, PlanCard, Section, Stars } from "@/components/site/parts";
import AreaChecker from "@/components/site/AreaChecker";

const STEPS: [string, string][] = [
  ["Tell us about you", "A ten-minute assessment: your goal, activity, allergies, foods you love and foods you won't touch."],
  ["We build your plan", "Your calorie and macro targets become a week of meals, scored against your preferences. You approve it before we cook."],
  ["We cook and label", "Every meal is cooked fresh, portioned to your targets and labelled with your name, nutrition, allergens and a best-before date."],
  ["Delivered, then refined", "Meals arrive chilled at your door. Rate them, log check-ins, and next week's plan adjusts to you."],
];

/** One meal per category, so the hero shows the range of a typical week. */
function heroMeals(menu: PublicMeal[]) {
  const picks: PublicMeal[] = [];
  for (const cat of ["breakfast", "lunch", "dinner"]) {
    const m = menu.filter((x) => x.category === cat).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    if (m) picks.push(m);
  }
  return picks;
}

const BAND: Record<string, string> = { breakfast: "bg-cat-breakfast", lunch: "bg-cat-lunch", dinner: "bg-cat-dinner" };

/** Headline ratings and volume figures are only shown once they are strong enough to help. */
const SHOW_RATING_FROM = 4;
const SHOW_MEALS_FROM = 500;
const SHOW_CLIENTS_FROM = 50;

export default async function Home() {
  const s = await siteInfo();
  const menu = await publicMenu();
  const plans = await publicPackages();
  const { reviews, average, count } = await publicReviews(3);
  const stats = await publicStats();
  const featured = [...menu].filter((m) => ["breakfast", "lunch", "dinner"].includes(m.category)).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6);
  const standard = plans.filter((p) => !p.custom);
  const lowest = standard.length ? Math.min(...standard.map((p) => p.per_meal)) : null;
  const hero = heroMeals(menu);
  const proof: [string, string][] = [
    ...(stats.mealsDelivered >= SHOW_MEALS_FROM ? [[stats.mealsDelivered.toLocaleString("en-ZA"), "meals delivered"] as [string, string]] : []),
    ...(stats.activeClients >= SHOW_CLIENTS_FROM ? [[String(stats.activeClients), "clients on a plan"] as [string, string]] : []),
    [String(stats.menuSize), "dishes on the menu"],
    [String(s.areas.length), `suburbs in ${s.city}`],
    ...(lowest != null ? [[formatZar0(lowest), "per meal on a plan"] as [string, string]] : []),
    ["0", "lock-in contracts"],
  ].slice(0, 4) as [string, string][];

  return (
    <>
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div>
          <div className="kicker mb-4">Personalised meal prep · {s.city}</div>
          <h1 className="text-5xl sm:text-6xl leading-[1.05]">Your nutrition plan, cooked and delivered.</h1>
          <p className="mt-6 text-lg text-ink-2 leading-relaxed max-w-xl">Chef-prepared meals built around your goals, allergies and taste — portioned to your targets, labelled with your name, and at your door every {s.deliveryDays}.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/onboard" className="btn-primary !px-6 !py-3 !text-base">Build my plan</Link>
            <Link href="/menu" className="btn-secondary !px-6 !py-3 !text-base">See the menu</Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
            {average != null && average >= SHOW_RATING_FROM && <li className="flex items-center gap-1.5"><Stars value={average} /> <b className="text-ink">{average.toFixed(1)}</b> from {count.toLocaleString("en-ZA")} meal ratings</li>}
            {lowest != null && <li>From <b className="text-ink">{formatZar0(lowest)}</b> a meal</li>}
            <li>Skip, pause or cancel any week</li>
          </ul>
        </div>
        <div className="flex flex-col py-4" aria-hidden>
          {hero.map((m, i) => (
            <div key={m.id} className={`relative w-[88%] sm:w-[72%] rounded-2xl bg-white border border-line shadow-[0_12px_40px_rgba(31,31,29,0.10)] overflow-hidden ${i ? "-mt-3" : ""} ${["self-start", "self-end", "self-center"][i]}`}
              style={{ transform: `rotate(${[-2.5, 2, -1.5][i]}deg)`, zIndex: i + 1 }}>
              <div className={`h-2 ${BAND[m.category]}`} />
              <div className="p-4">
                <div className="flex justify-between text-[10px] uppercase tracking-[0.14em] text-ink-3"><span>{s.brand}</span><span>Meal {String(i * 4 + 3).padStart(2, "0")} of 14</span></div>
                <div className="font-display text-lg mt-1.5 leading-snug">{m.name}</div>
                <div className="text-xs text-ink-3 mb-3"><span className="capitalize">{m.category}</span> · prepared for you</div>
                <Macros n={m.nutrition} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Proof strip */}
      <div className="border-y border-line bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {proof.map(([v, l]) => <div key={l}><div className="font-display text-3xl">{v}</div><div className="text-xs text-ink-3 mt-1">{l}</div></div>)}
        </div>
      </div>

      {/* How it works */}
      <Section kicker="How it works" title="From your goals to your fridge in four steps." intro="No guesswork, no generic menus. Your plan starts with you and gets better every week.">
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="card p-6">
              <div className="font-display text-4xl text-accent">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="text-lg mt-4">{t}</h3>
              <p className="text-sm text-ink-2 mt-2 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8"><Link href="/how-it-works" className="text-sm font-medium text-accent hover:text-accent-2">More on how we plan and cook →</Link></div>
      </Section>

      {/* Menu preview */}
      <Section tone="white" kicker="On the menu" title="Real food, measured properly." intro={`${stats.menuSize} dishes across breakfast, lunch, dinner and snacks. Nutrition is calculated from each recipe's ingredients, so the numbers on your label are the numbers in your meal.`}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{featured.map((m) => <MealCard key={m.id} meal={m} />)}</div>
        <div className="mt-10 text-center"><Link href="/menu" className="btn-secondary !px-6 !py-3">Browse the full menu</Link></div>
      </Section>

      {/* Personalisation */}
      <Section tone="ink" kicker="Why it works" title="Not a menu. A plan made for one person: you." intro="Most meal services sell the same box to everyone. We start with your body and your week, then cook to it.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
          {([
            ["Targets, not guesses", "Calorie, protein, carb, fat and fibre targets from recognised equations, adjusted for your goal with safe limits."],
            ["Allergies handled seriously", "Declared allergens are excluded from your plan entirely, not just flagged, and printed in bold on every label."],
            ["Your taste counts", "Likes, dislikes, cuisines and spice level shape every recommendation, so you eat food you actually want."],
            ["Professional oversight", "Pregnancy, medical conditions or a restricted diet? We recommend a professional review before personalising."],
            ["Progress you can see", "Log weight and energy check-ins in your portal and watch your plan adapt week to week."],
            ["Flexible by default", "Skip a week, pause while you travel, or cancel from your portal. No phone calls, no lock-in."],
          ] as const).map(([t, d]) => (
            <div key={t} className="border-t border-bone/15 pt-5"><h3 className="text-lg text-bone">{t}</h3><p className="text-sm text-bone/70 mt-2 leading-relaxed">{d}</p></div>
          ))}
        </div>
      </Section>

      {/* Plans */}
      <Section kicker="Plans & pricing" title="Pick how many meals. Change it whenever." intro={`The more meals you plan, the less each one costs. Delivery is ${formatZar0(s.deliveryFee)} per drop.`}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-3">{standard.map((p) => <PlanCard key={p.id} p={p} cta="Start with this plan" />)}</div>
        <div className="mt-8 text-sm text-ink-2">Feeding a family or want fully custom planning with check-ins? <Link href="/plans" className="font-medium text-accent hover:text-accent-2">See Family and Premium Custom →</Link></div>
      </Section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <Section tone="white" kicker="From our clients" title="Rated meal by meal.">
          <div className="grid md:grid-cols-3 gap-5">
            {reviews.map((r) => (
              <figure key={r.id} className="card p-6 flex flex-col">
                <Stars value={r.overall} />
                <blockquote className="font-display text-xl leading-snug mt-3 flex-1">“{r.comment}”</blockquote>
                <figcaption className="text-sm text-ink-3 mt-4">{r.name}{r.meal && ` · ${r.meal}`}</figcaption>
              </figure>
            ))}
          </div>
          {average != null && average >= SHOW_RATING_FROM && <p className="mt-6 text-sm text-ink-3">Average {average.toFixed(1)} / 5 across {count.toLocaleString("en-ZA")} ratings clients left after delivery.</p>}
        </Section>
      )}

      {/* Delivery */}
      <Section kicker="Delivery" title={`Delivering across ${s.city}.`}>
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-4 text-ink-2">
            <p>We deliver on <b className="text-ink">{s.deliveryDays}</b>, chilled and ready for the fridge. Order by <b className="text-ink">{s.cutoff}</b>.</p>
            <ul className="flex flex-wrap gap-2">{s.areas.map((a) => <li key={a} className="badge bg-white border border-line text-ink-2 !text-xs !px-3 !py-1">{a}</li>)}</ul>
          </div>
          <AreaChecker areas={s.areas} />
        </div>
      </Section>

      {/* FAQ */}
      <Section tone="white" kicker="Questions" title="Good to know.">
        <Faq items={[
          ["How long do the meals keep?", "Each meal is labelled with the day it was prepared and its best-before date — typically two to five days refrigerated at or below 4°C, depending on the dish. We plan your delivery days so nothing sits too long."],
          ["Can I skip a week or pause?", "Yes. Skip next week, pause or cancel from your client portal at any time. Changes made before the order cut-off apply to the coming week."],
          ["I have allergies. Is it safe?", "Allergens you declare are excluded from your plan entirely and every label lists ingredients and bold allergens. Our kitchen handles common allergens, so if you have a severe allergy, tell us during your assessment and we'll talk you through it."],
          ["Is this medical nutrition advice?", "No. Targets are estimates from recognised equations and are general guidance. If you are pregnant, under 18, managing a medical condition or a restricted diet, we recommend a review with a registered dietitian or doctor first."],
          ["How do I pay?", "Plans are billed weekly, bi-weekly or monthly, by EFT or card. You can see every invoice and payment in your portal."],
        ]} />
      </Section>

      <CtaBand title="Ready for a week you don't have to think about?" body="Start your free assessment. It takes about ten minutes and you'll see your nutrition summary straight away." primary={["Build my plan", "/onboard"]} secondary={["Ask us a question", "/contact"]} />
    </>
  );
}
