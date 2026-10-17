import Link from "next/link";
import type { Metadata } from "next";
import { formatZar0 } from "@/lib/costing";
import { publicPackages, siteInfo } from "@/lib/site";
import { CtaBand, Faq, PlanCard, Section } from "@/components/site/parts";

export const metadata: Metadata = { title: "Plans & pricing" };

const INCLUDED = [
  "Nutrition assessment and personal calorie & macro targets",
  "A weekly plan you approve before we cook",
  "Allergen exclusion and preference matching",
  "Personalised labels with nutrition, allergens and best-before",
  "Client portal: plan, orders, deliveries, progress and payments",
  "Skip, pause or cancel from your portal",
];

export default function PlansPage() {
  const s = siteInfo();
  const plans = publicPackages();
  const standard = plans.filter((p) => !p.custom);
  const custom = plans.filter((p) => p.custom);
  return (
    <>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-6 text-center">
        <div className="kicker mb-3">Plans & pricing</div>
        <h1 className="text-4xl sm:text-5xl leading-tight max-w-3xl mx-auto">Simple pricing. The more you plan, the less each meal costs.</h1>
        <p className="mt-4 text-ink-2 max-w-2xl mx-auto leading-relaxed">Every plan is personalised. Pick the number of meals that fits your week — you can change it at any time. Delivery is {formatZar0(s.deliveryFee)} per drop.</p>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-3">{standard.map((p) => <PlanCard key={p.id} p={p} cta={`Choose ${p.name}`} />)}</div>
      </section>

      {custom.length > 0 && (
        <Section tone="white" kicker="For more than one, or more than meals" title="Tailored plans.">
          <div className="grid md:grid-cols-2 gap-5 max-w-4xl">{custom.map((p) => <PlanCard key={p.id} p={p} cta="Talk to us" />)}</div>
        </Section>
      )}

      <Section kicker="Every plan includes" title="Personal from the first meal.">
        <ul className="grid sm:grid-cols-2 gap-x-10 gap-y-4 max-w-4xl">
          {INCLUDED.map((x) => <li key={x} className="flex gap-3 text-ink-2"><span className="text-accent font-semibold" aria-hidden>✓</span>{x}</li>)}
        </ul>
      </Section>

      <Section tone="white" kicker="Billing & delivery" title="Questions about plans.">
        <Faq items={[
          ["How does billing work?", "Choose weekly, bi-weekly or monthly billing. Pay by EFT or card; invoices and payments are always visible in your portal."],
          ["Can I change my plan later?", "Yes. Skip a week, pause or cancel from your portal, or message us to move up or down a plan. Changes before the cut-off apply to the coming week."],
          ["When do you deliver?", <>We deliver on {s.deliveryDays} in {s.areas.join(", ")}. Order by {s.cutoff}. Outside these areas? <Link href="/contact" className="text-accent">Join the waitlist</Link>.</>],
          ["Can I just order a few meals?", <>Yes — every dish on the <Link href="/menu" className="text-accent">menu</Link> can be ordered individually at the listed price. Plans are better value per meal.</>],
          ["Do you do office or gym orders?", <>We work with teams and gyms on volume pricing. <Link href="/contact" className="text-accent">Tell us what you need</Link>.</>],
        ]} />
      </Section>

      <CtaBand title="Not sure which plan fits?" body="Do the assessment first. We'll recommend meals per day and a plan based on your targets and budget." primary={["Start my assessment", "/onboard"]} secondary={["Ask a question", "/contact"]} />
    </>
  );
}
