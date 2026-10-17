import Link from "next/link";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { siteInfo } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = siteInfo();
  return {
    title: { default: `${s.brand} — Personalised meal prep in ${s.city}`, template: `%s · ${s.brand}` },
    description: `Chef-prepared meals planned around your nutrition targets, allergies and schedule. Delivered on ${s.deliveryDays} across ${s.city}.`,
  };
}

const NAV: [string, string][] = [["/menu", "Menu"], ["/plans", "Plans & pricing"], ["/how-it-works", "How it works"], ["/contact", "Contact"]];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const s = siteInfo();
  const user = await getSessionUser();
  const app = user ? (user.role === "client" ? ["/portal", "My portal"] : ["/dashboard", "Dashboard"]) : null;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bone/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-lg sm:text-xl whitespace-nowrap">{s.brand}</Link>
          <nav className="hidden md:flex items-center gap-1">{NAV.map(([h, l]) => <Link key={h} href={h} className="px-3 py-2 text-sm text-ink-2 hover:text-ink">{l}</Link>)}</nav>
          <div className="flex items-center gap-2">
            {app ? <Link href={app[0]} className="btn-primary whitespace-nowrap">{app[1]}</Link> : (
              <>
                <span className="hidden sm:block"><Link href="/login" className="btn-ghost">Sign in</Link></span>
                <Link href="/onboard" className="btn-primary whitespace-nowrap">Get started</Link>
              </>
            )}
            <details className="md:hidden relative">
              <summary className="list-none btn-ghost !px-2.5 cursor-pointer" aria-label="Menu">☰</summary>
              <nav className="absolute right-0 mt-2 w-56 card p-2 flex flex-col">
                {NAV.map(([h, l]) => <Link key={h} href={h} className="nav-link">{l}</Link>)}
                {!app && <Link href="/login" className="nav-link">Sign in</Link>}
              </nav>
            </details>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-ink text-bone/70 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2 max-w-sm">
            <div className="font-display text-2xl text-bone">{s.brand}</div>
            <p className="mt-2">{s.tagline}</p>
            <p className="mt-4 text-xs leading-relaxed text-bone/50">{s.disclaimer}</p>
          </div>
          <div>
            <div className="kicker !text-bone/50 mb-3">Explore</div>
            <ul className="space-y-2">{NAV.map(([h, l]) => <li key={h}><Link href={h} className="hover:text-bone">{l}</Link></li>)}<li><Link href="/onboard" className="hover:text-bone">Start your assessment</Link></li></ul>
          </div>
          <div>
            <div className="kicker !text-bone/50 mb-3">Get in touch</div>
            <ul className="space-y-2">
              {s.email && <li><a href={`mailto:${s.email}`} className="hover:text-bone">{s.email}</a></li>}
              {s.phone && <li><a href={`tel:${s.phone.replace(/\s/g, "")}`} className="hover:text-bone">{s.phone}</a></li>}
              <li><Link href="/contact" className="hover:text-bone">Send us a message</Link></li>
              <li>Delivering {s.deliveryDays} in {s.city}</li>
              <li><Link href="/login" className="hover:text-bone">Client & staff sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-bone/10"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-bone/40">© {new Date().getFullYear()} {s.brand} — your health information is handled in line with POPIA.</div></div>
      </footer>
    </div>
  );
}
