import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission, can } from "@/lib/auth";
import { labelsForOrder } from "@/lib/repo/production";
import { getMealFull } from "@/lib/repo/meals";
import { getSetting } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import PrintButton from "@/components/PrintButton";
import { markPrintedAction } from "@/app/actions";
import { ALLERGEN_LABELS } from "@/lib/types";
import { fmtDate } from "@/components/ui";

const BAND: Record<string, string> = { breakfast: "#d9a441", lunch: "#6f7f3f", dinner: "#5a3e5c", snack: "#c98e7b", dessert: "#c98e7b", drink: "#8c9a8e" };

export default async function Labels({ params }: { params: Promise<{ orderId: string }> }) {
  const user = await requirePermission("labels:view");
  const { orderId } = await params;
  const labels = labelsForOrder(Number(orderId));
  if (!labels) notFound();
  const brand = getSetting("brand_name");
  return (
    <div>
      <div className="no-print"><PageHeader kicker="Labels" title={`${labels[0]?.client_name ?? ""} · ${labels[0]?.order_number ?? ""}`} actions={<><PrintButton label="Print labels" />{can(user, "labels:print") && <form action={markPrintedAction}><input type="hidden" name="order_id" value={orderId} /><button className="btn-primary btn-sm">Mark printed</button></form>}<Link href={`/orders/${orderId}`} className="btn-secondary btn-sm">Order</Link></>}>{labels.length} labels · each QR opens the client’s digital meal page (recipe, ingredients, nutrition, reheating, feedback).</PageHeader></div>
      <div className="label-sheet grid md:grid-cols-2 gap-4">
        {labels.map((l) => { const m = getMealFull(l.meal_id)!; const mult = l.portion_multiplier; const n = m.nutrition; return (
          <div key={l.id} className="label bg-white border border-line rounded-xl overflow-hidden text-[11px] leading-snug" style={{ borderTop: `6px solid ${BAND[m.meal.category] ?? "#8c9a8e"}` }}>
            <div className="p-3 grid grid-cols-[1fr_auto] gap-3">
              <div>
                <div className="font-display text-base">{brand}</div>
                <div className="kicker mt-1">Prepared for</div>
                <div className="font-semibold text-sm">{l.client_name}</div>
                <div className="font-display text-lg mt-1 leading-tight">{m.meal.name}</div>
                <div className="text-ink-2">Meal {String(l.meal_number).padStart(2, "0")} of {l.total} · {m.meal.category}{mult !== 1 ? ` · ${mult}× portion` : ""}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-3"><div><span className="text-ink-3">Prepared</span> {fmtDate(l.prepared_on)}</div><div><span className="text-ink-3">Best before</span> <b>{fmtDate(l.best_before)}</b></div></div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/qr/${l.token}`} alt="QR code" width={84} height={84} className="rounded" />
            </div>
            <div className="border-t border-line p-3 grid grid-cols-2 gap-3">
              <div>
                <table className="w-full"><tbody>
                  <tr><td className="text-ink-3">Energy</td><td className="text-right font-medium">{Math.round(n.kcal * mult)} kcal</td></tr>
                  <tr><td className="text-ink-3">Protein</td><td className="text-right">{(n.protein * mult).toFixed(1)} g</td></tr>
                  <tr><td className="text-ink-3">Carbohydrate</td><td className="text-right">{(n.carbs * mult).toFixed(1)} g</td></tr>
                  <tr><td className="text-ink-3">Fat</td><td className="text-right">{(n.fat * mult).toFixed(1)} g</td></tr>
                  <tr><td className="text-ink-3">Fibre</td><td className="text-right">{(n.fibre * mult).toFixed(1)} g</td></tr>
                  <tr><td className="text-ink-3">Sodium</td><td className="text-right">{Math.round(n.sodium_mg * mult)} mg</td></tr>
                </tbody></table>
              </div>
              <div>
                <div><span className="text-ink-3">Ingredients:</span> {m.lines.map((x) => x.ingredient.name).join(", ")}.</div>
                <div className="mt-1"><span className="text-ink-3">Allergens:</span> <b>{m.allergens.length ? m.allergens.map((a) => ALLERGEN_LABELS[a] ?? a).join(", ") : "none declared"}</b></div>
                <div className="mt-1"><span className="text-ink-3">Storage:</span> {m.meal.storage}</div>
                <div><span className="text-ink-3">Reheat:</span> {m.meal.reheating}</div>
              </div>
            </div>
          </div>); })}
      </div>
    </div>
  );
}
