import Link from "next/link";
import type { Metadata } from "next";
import { siteInfo } from "@/lib/site";
import { submitEnquiry } from "./actions";

export const metadata: Metadata = { title: "Contact" };

const INTERESTS = ["A personal plan", "Family meals", "Office or team meals", "Gym or coach partnership", "Delivery to my area", "Something else"];

export default async function Contact({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; suburb?: string }> }) {
  const { sent, error, suburb } = await searchParams;
  const s = siteInfo();
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-24 grid lg:grid-cols-[1fr_1.2fr] gap-12">
      <div>
        <div className="kicker mb-3">Contact</div>
        <h1 className="text-4xl sm:text-5xl leading-tight">Talk to a real person.</h1>
        <p className="mt-4 text-ink-2 leading-relaxed">Questions about plans, allergies, family or office orders, or delivery to your area — send us a note and we&apos;ll get back to you.</p>
        <dl className="mt-8 space-y-5 text-sm">
          {s.email && <div><dt className="kicker">Email</dt><dd className="mt-1"><a href={`mailto:${s.email}`} className="text-accent">{s.email}</a></dd></div>}
          {s.phone && <div><dt className="kicker">Phone / WhatsApp</dt><dd className="mt-1"><a href={`tel:${s.phone.replace(/\s/g, "")}`} className="text-accent">{s.phone}</a></dd></div>}
          <div><dt className="kicker">Delivery</dt><dd className="mt-1 text-ink-2">{s.deliveryDays} · {s.areas.join(", ")}</dd></div>
          <div><dt className="kicker">Order cut-off</dt><dd className="mt-1 text-ink-2">{s.cutoff}</dd></div>
        </dl>
        <div className="mt-10 card p-5 text-sm text-ink-2">Ready to start? The <Link href="/onboard" className="text-accent font-medium">assessment</Link> takes about ten minutes and gives you a nutrition summary straight away.</div>
      </div>

      {sent ? (
        <div className="card p-8 self-start">
          <h2 className="text-2xl">Thank you — message received.</h2>
          <p className="text-ink-2 mt-3">We&apos;ll be in touch soon. In the meantime, have a look at the <Link href="/menu" className="text-accent">menu</Link>.</p>
        </div>
      ) : (
        <form action={submitEnquiry} className="card p-6 sm:p-8 grid sm:grid-cols-2 gap-4 self-start">
          {error && <div className="sm:col-span-2 text-sm text-critical" role="alert">{error}</div>}
          <label className="sm:col-span-2"><span className="label">Your name</span><input name="name" required className="input" autoComplete="name" /></label>
          <label><span className="label">Email</span><input name="email" type="email" className="input" autoComplete="email" /></label>
          <label><span className="label">Phone</span><input name="phone" type="tel" className="input" autoComplete="tel" /></label>
          <label><span className="label">Suburb</span><input name="suburb" defaultValue={suburb ?? ""} className="input" autoComplete="address-level3" /></label>
          <label><span className="label">I&apos;m interested in</span><select name="interest" defaultValue={suburb ? "Delivery to my area" : ""} className="input"><option value="">Choose one</option>{INTERESTS.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="sm:col-span-2"><span className="label">Message</span><textarea name="message" rows={5} className="input" placeholder="Tell us a little about what you're looking for." /></label>
          <label className="hidden" aria-hidden>Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
          <label className="sm:col-span-2 flex gap-2 text-xs text-ink-2 leading-relaxed"><input type="checkbox" name="consent" required className="mt-0.5" /><span>I agree that {s.brand} may store these details and contact me about this enquiry (POPIA). Please don&apos;t include health information here — we&apos;ll ask for it securely in the assessment.</span></label>
          <div className="sm:col-span-2"><button className="btn-primary !px-6 !py-3">Send message</button></div>
        </form>
      )}
    </section>
  );
}
