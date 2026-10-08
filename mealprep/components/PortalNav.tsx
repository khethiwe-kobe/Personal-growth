"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const ITEMS = [["/portal", "Home"], ["/portal/plan", "My plan"], ["/portal/meals", "My meals"], ["/portal/nutrition", "Nutrition"], ["/portal/progress", "Progress"], ["/portal/orders", "Orders"], ["/portal/deliveries", "Deliveries"], ["/portal/subscription", "Subscription"], ["/portal/payments", "Payments"], ["/portal/grocery", "Grocery"], ["/portal/recipes", "Recipes"], ["/portal/feedback", "Feedback"], ["/portal/profile", "Profile"]];
export default function PortalNav() {
  const p = usePathname();
  return <nav className="flex gap-1 overflow-x-auto py-1 -mx-1">{ITEMS.map(([h, l]) => <Link key={h} href={h} className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${p === h ? "bg-ink text-white" : "text-ink-2 hover:bg-bone-2"}`}>{l}</Link>)}</nav>;
}
