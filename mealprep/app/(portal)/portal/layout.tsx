import Link from "next/link";
import { requireClient } from "@/lib/auth";
import { getSetting } from "@/lib/db";
import PortalNav from "@/components/PortalNav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClient();
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between"><Link href="/portal" className="font-display text-lg">{getSetting("brand_name")}</Link><div className="flex items-center gap-3 text-sm"><span className="text-ink-2 hidden sm:inline">{user.name}</span><Link href="/notifications" className="btn-ghost btn-sm">🔔</Link><form action="/logout" method="post"><button className="btn-ghost btn-sm">Sign out</button></form></div></div>
        <div className="max-w-5xl mx-auto px-4"><PortalNav /></div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      <footer className="max-w-5xl mx-auto px-4 py-8 text-[11px] text-ink-3">{getSetting("disclaimer")}</footer>
    </div>
  );
}
