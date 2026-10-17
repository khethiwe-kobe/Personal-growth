import { getDb, getSetting, getSettingNumber } from "./db";
import { listMeals, mealProfiles } from "./repo/meals";
import { audit } from "./audit";
import { notifyStaff } from "./automation";
import type { Nutrition } from "./types";

/**
 * Read model for the public website. Everything shown to visitors comes from
 * the same records the business runs on (meals, packages, feedback, settings),
 * and only customer-facing fields leave this module — never cost or margin.
 */

export type SiteInfo = {
  brand: string; tagline: string; city: string; areas: string[]; deliveryDays: string;
  cutoff: string; email: string; phone: string; deliveryFee: number; disclaimer: string;
};

export function siteInfo(): SiteInfo {
  return {
    brand: getSetting("brand_name"),
    tagline: getSetting("tagline"),
    city: getSetting("site_city"),
    areas: getSetting("site_delivery_areas").split(",").map((a) => a.trim()).filter(Boolean),
    deliveryDays: getSetting("site_delivery_days"),
    cutoff: getSetting("site_order_cutoff"),
    email: getSetting("site_contact_email"),
    phone: getSetting("site_contact_phone"),
    deliveryFee: getSettingNumber("delivery_cost_per_order"),
    disclaimer: getSetting("disclaimer"),
  };
}

export type PublicMeal = {
  id: number; name: string; category: string; cuisine: string; description: string;
  tags: string[]; allergens: string[]; nutrition: Nutrition; price: number; rating: number | null;
};

export const MENU_CATEGORIES = ["breakfast", "lunch", "dinner", "snack", "dessert", "drink"] as const;

export const TAG_LABELS: Record<string, string> = {
  high_protein: "High protein", lower_carb: "Lower carb", gluten_free: "Gluten-free", dairy_free: "Dairy-free",
  vegetarian: "Vegetarian", vegan: "Vegan", pescatarian: "Pescatarian", halal: "Halal", low_sodium: "Low sodium",
  nut_free: "Nut-free", kid_friendly: "Kid-friendly", low_fodmap: "Low FODMAP",
};

export function publicMenu(): PublicMeal[] {
  const desc = new Map(listMeals().map((m) => [m.id, m.description]));
  return mealProfiles()
    .map((m) => ({
      id: m.id, name: m.name, category: m.category, cuisine: m.cuisine, description: desc.get(m.id) ?? "",
      tags: m.dietary_tags, allergens: m.allergens, nutrition: m.nutrition, price: m.price, rating: m.avg_rating,
    }))
    .sort((a, b) => MENU_CATEGORIES.indexOf(a.category as never) - MENU_CATEGORIES.indexOf(b.category as never) || a.name.localeCompare(b.name));
}

export type PublicPackage = {
  id: number; code: string; name: string; description: string; meals_per_week: number;
  price: number; per_meal: number; custom: boolean; popular: boolean;
};

/** Active packages; "most popular" is the standard package with the most live subscriptions. */
export function publicPackages(): PublicPackage[] {
  const rows = getDb().prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM subscriptions s WHERE s.package_id = p.id AND s.status IN ('active','paused')) AS subs
       FROM packages p WHERE p.is_active = 1 ORDER BY p.sort_order, p.id`
  ).all() as { id: number; code: string; name: string; description: string; meals_per_week: number; price_zar: number; is_custom: number; subs: number }[];
  const standard = rows.filter((r) => !r.is_custom);
  const top = standard.reduce<(typeof rows)[number] | null>((best, r) => (!best || r.subs > best.subs ? r : best), null);
  const popularId = top && top.subs > 0 ? top.id : standard[Math.min(1, standard.length - 1)]?.id;
  return rows.map((r) => ({
    id: r.id, code: r.code, name: r.name, description: r.description, meals_per_week: r.meals_per_week,
    price: r.price_zar, per_meal: r.meals_per_week ? r.price_zar / r.meals_per_week : r.price_zar,
    custom: !!r.is_custom, popular: r.id === popularId,
  }));
}

export type Review = { id: number; name: string; meal: string | null; comment: string; overall: number };

/** Mixed feedback ("a little dry", "could use less salt") can still carry a five-star score; keep it off the homepage. */
const CRITICAL_WORDS = /\b(but|could|should|less|more|little|too|not|bit|wish|please|dry|bland|late|cold)\b/i;

/** Recent five-star comments, attributed as first name + initial only (POPIA). */
export function publicReviews(limit = 6): { reviews: Review[]; average: number | null; count: number } {
  const db = getDb();
  const agg = db.prepare("SELECT AVG(overall) AS avg, COUNT(*) AS n FROM feedback WHERE overall IS NOT NULL").get() as { avg: number | null; n: number };
  const rows = db.prepare(
    `SELECT f.id, f.comment, f.overall, c.first_name, c.last_name, m.name AS meal
       FROM feedback f JOIN clients c ON c.id = f.client_id LEFT JOIN meals m ON m.id = f.meal_id
      WHERE f.overall = 5 AND length(trim(f.comment)) > 0 AND c.anonymised_at IS NULL
      ORDER BY f.created_at DESC LIMIT 60`
  ).all() as { id: number; comment: string; overall: number; first_name: string; last_name: string; meal: string | null }[];
  const seen = new Set<string>();
  const reviews: Review[] = [];
  for (const r of rows) {
    if (seen.has(r.comment) || CRITICAL_WORDS.test(r.comment)) continue;
    seen.add(r.comment);
    reviews.push({ id: r.id, name: `${r.first_name} ${r.last_name.charAt(0)}.`, meal: r.meal, comment: r.comment, overall: r.overall });
    if (reviews.length >= limit) break;
  }
  return { reviews, average: agg.avg, count: agg.n };
}

export function publicStats() {
  const db = getDb();
  const meals = db.prepare(
    "SELECT COALESCE(SUM(oi.quantity), 0) AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status IN ('delivered','completed')"
  ).get() as { n: number };
  const clients = db.prepare("SELECT COUNT(*) AS n FROM clients WHERE status = 'active'").get() as { n: number };
  return { mealsDelivered: meals.n, activeClients: clients.n, menuSize: listMeals().length };
}

export type Enquiry = { name: string; email: string; phone: string; suburb: string; interest: string; message: string };

/** A website enquiry becomes a CRM lead (status 'lead', source 'website') and notifies the owner and planners. */
export function createEnquiry(e: Enquiry): number {
  const [first, ...rest] = e.name.trim().split(/\s+/);
  const notes = [`Website enquiry${e.interest ? ` — interested in: ${e.interest}` : ""}`, e.suburb && `Suburb: ${e.suburb}`, e.message].filter(Boolean).join("\n");
  const id = Number(getDb().prepare(
    "INSERT INTO clients (first_name, last_name, email, phone, address, status, source, notes) VALUES (?, ?, ?, ?, ?, 'lead', 'website', ?)"
  ).run(first, rest.join(" "), e.email, e.phone, e.suburb, notes).lastInsertRowid);
  audit(null, "create", "client", id, "website enquiry");
  notifyStaff(["admin", "planner"], "New website enquiry", `${e.name}${e.interest ? ` · ${e.interest}` : ""}${e.suburb ? ` · ${e.suburb}` : ""}`, `/clients/${id}`);
  return id;
}

export const PUBLIC_PATHS = ["/", "/menu", "/plans", "/how-it-works", "/contact", "/onboard"];

export function siteUrl(): string {
  return (process.env.MEALPREP_PUBLIC_URL || "http://localhost:3200").replace(/\/$/, "");
}
