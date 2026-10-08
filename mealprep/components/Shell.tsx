"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SessionUser, Permission } from "@/lib/auth";

type NavItem = { href: string; label: string; perm?: Permission };
type NavGroup = { title: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  { title: "Overview", items: [
    { href: "/dashboard", label: "Dashboard", perm: "dashboard:view" },
    { href: "/workflow", label: "Workflow", perm: "dashboard:view" },
    { href: "/assistant", label: "Assistant", perm: "assistant:use" },
  ] },
  { title: "Clients", items: [
    { href: "/clients", label: "Clients", perm: "clients:view" },
    { href: "/onboard", label: "Onboard a client", perm: "clients:edit" },
    { href: "/feedback", label: "Feedback", perm: "clients:view" },
  ] },
  { title: "Nutrition", items: [
    { href: "/meals", label: "Meals & recipes", perm: "meals:view" },
    { href: "/ingredients", label: "Ingredients", perm: "meals:view" },
    { href: "/meal-plans", label: "Meal plans", perm: "plans:view" },
  ] },
  { title: "Operations", items: [
    { href: "/orders", label: "Orders", perm: "orders:view" },
    { href: "/subscriptions", label: "Subscriptions", perm: "orders:view" },
    { href: "/grocery", label: "Grocery list", perm: "inventory:view" },
    { href: "/inventory", label: "Inventory", perm: "inventory:view" },
    { href: "/suppliers", label: "Suppliers", perm: "suppliers:view" },
    { href: "/production", label: "Production", perm: "production:view" },
    { href: "/packaging", label: "Packaging & labels", perm: "labels:view" },
    { href: "/deliveries", label: "Deliveries", perm: "deliveries:view" },
  ] },
  { title: "Finance", items: [
    { href: "/payments", label: "Payments", perm: "finance:view" },
    { href: "/expenses", label: "Expenses", perm: "finance:view" },
    { href: "/pricing", label: "Pricing engine", perm: "finance:view" },
    { href: "/finance", label: "Finance dashboard", perm: "finance:view" },
    { href: "/analytics", label: "Analytics", perm: "analytics:view" },
    { href: "/reports", label: "Reports", perm: "analytics:view" },
  ] },
  { title: "Business", items: [
    { href: "/business-plan", label: "Business plan", perm: "business:view" },
    { href: "/startup-costs", label: "Startup costs", perm: "business:view" },
    { href: "/break-even", label: "Break-even", perm: "business:view" },
    { href: "/marketing", label: "Marketing", perm: "marketing:view" },
    { href: "/brand", label: "Brand", perm: "business:view" },
    { href: "/compliance", label: "Compliance", perm: "compliance:view" },
    { href: "/automations", label: "Automations", perm: "settings:edit" },
    { href: "/settings", label: "Settings", perm: "settings:edit" },
    { href: "/audit", label: "Audit log", perm: "audit:view" },
  ] },
];

export default function Shell({ user, perms, brand, notifications, children }: { user: SessionUser; perms: Permission[]; brand: string; notifications: number; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || perms.includes(i.perm)) })).filter((g) => g.items.length);
  const nav = (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="kicker px-3 mb-1.5">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map((i) => <Link key={i.href} href={i.href} onClick={() => setOpen(false)} className={`nav-link ${path === i.href || (i.href !== "/dashboard" && path.startsWith(i.href + "/")) || path === i.href ? "active" : ""}`}>{i.label}</Link>)}
          </div>
        </div>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden lg:flex flex-col border-r border-line bg-white/60 backdrop-blur px-3 py-5 sticky top-0 h-screen overflow-y-auto">
        <Link href="/dashboard" className="px-3 mb-6"><div className="font-display text-xl">{brand}</div><div className="text-[11px] text-ink-3">Command centre</div></Link>
        {nav}
        <div className="mt-auto pt-6 px-3 text-xs text-ink-2">
          <div className="font-medium text-ink">{user.name}</div>
          <div className="capitalize">{user.role}</div>
          <form action="/logout" method="post"><button className="btn-ghost btn-sm mt-2 -ml-3">Sign out</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-line bg-white/70 sticky top-0 z-20">
          <button className="btn-secondary btn-sm" onClick={() => setOpen(!open)} aria-label="Menu">☰ Menu</button>
          <div className="font-display">{brand}</div>
          <Link href="/notifications" className="text-xs">🔔 {notifications}</Link>
        </header>
        {open && <div className="lg:hidden border-b border-line bg-white px-3 py-4">{nav}<form action="/logout" method="post" className="px-3 pt-4"><button className="btn-secondary btn-sm">Sign out</button></form></div>}
        <div className="hidden lg:flex justify-end px-8 pt-4"><Link href="/notifications" className="btn-ghost btn-sm">🔔 Notifications{notifications ? <span className="badge bg-accent text-white">{notifications}</span> : null}</Link></div>
        <main className="px-4 py-6 lg:px-8 lg:py-4 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
