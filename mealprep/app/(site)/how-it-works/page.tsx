import type { Metadata } from "next";
import { siteInfo } from "@/lib/site";
import { CtaBand, Section } from "@/components/site/parts";

export const metadata: Metadata = { title: "How it works" };

export default async function HowItWorks() {
  const s = await siteInfo();
  const steps: [string, string, string[]][] = [
    ["Your assessment", "Ten short steps, about ten minutes. Everything we cook starts here.", ["Goal: lose, maintain, gain or perform", "Height, weight, activity and training", "Allergies, intolerances and dietary pattern", "Foods you love, foods you avoid, cuisines and spice level", "Meals per day, snacks, people served and budget"]],
    ["Your targets", "We calculate a daily energy range and macros using the Mifflin-St Jeor equation and activity multipliers, then adjust for your goal.", ["Deficits are capped and never go below safety floors", "Protein, carbs, fat, fibre and water targets", "Split across your meals and snacks", "Flags for professional review where it matters"]],
    ["Your week", "Our planner scores every dish against your targets and preferences and builds Monday to Sunday.", ["Declared allergens excluded outright", "Variety rotated so you don't eat the same thing twice in a row", "Each day checked for energy, protein and fibre", "You approve the plan before anything is cooked"]],
    ["Your kitchen", "We shop, cook and portion in our kitchen, then label every container for you.", ["Cooked fresh in batches, chilled quickly", "Portions scaled to your targets", "Labels: your name, meal number, nutrition, ingredients, bold allergens", "Storage, reheating and best-before on every meal, plus a QR code"]],
    ["Your door", `Delivered chilled on ${s.deliveryDays} across ${s.city}.`, ["Delivery window sent ahead of time", "Track deliveries in your portal", "Rate each meal after it arrives", "Log check-ins so next week's plan adapts"]],
  ];
  return (
    <>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-4">
        <div className="kicker mb-3">How it works</div>
        <h1 className="text-4xl sm:text-5xl leading-tight max-w-3xl">Planned like a nutritionist would. Cooked like a chef would.</h1>
        <p className="mt-4 text-ink-2 max-w-2xl leading-relaxed">Here is exactly what happens between your assessment and your first meal.</p>
      </section>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <ol className="space-y-6">
          {steps.map(([t, d, pts], i) => (
            <li key={t} className="card p-6 sm:p-8 grid md:grid-cols-[auto_1fr_1fr] gap-6 items-start">
              <div className="font-display text-5xl text-accent leading-none">{String(i + 1).padStart(2, "0")}</div>
              <div><h2 className="text-2xl">{t}</h2><p className="text-ink-2 mt-2 leading-relaxed">{d}</p></div>
              <ul className="space-y-2 text-sm text-ink-2">{pts.map((p) => <li key={p} className="flex gap-2"><span className="text-accent" aria-hidden>—</span>{p}</li>)}</ul>
            </li>
          ))}
        </ol>
      </section>
      <Section tone="ink" kicker="Our health stance" title="Careful by design." intro="Personalised nutrition should never be reckless. These rules are built into how we plan.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {([
            ["No crash diets", "Calorie deficits are capped and never drop below safety floors."],
            ["Review when it matters", "Under-18s, pregnancy, medical conditions, eating-disorder history and restricted diets are flagged for professional review first."],
            ["No pseudo-science", "Blood type is never used to plan meals. Targets come from recognised equations."],
            ["Your data, protected", "Health information is stored as special personal information under POPIA and used only to plan your meals."],
          ] as const).map(([t, d]) => <div key={t} className="border-t border-bone/15 pt-5"><h3 className="text-lg text-bone">{t}</h3><p className="text-sm text-bone/70 mt-2 leading-relaxed">{d}</p></div>)}
        </div>
      </Section>
      <CtaBand title="Start with the assessment." body="Ten minutes now, a week of meals you don't have to think about." primary={["Build my plan", "/onboard"]} secondary={["See the menu", "/menu"]} />
    </>
  );
}
