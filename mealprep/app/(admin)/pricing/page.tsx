import { requirePermission, can } from "@/lib/auth";
import { getAllSettings } from "@/lib/db";
import { mealProfiles, listMeals } from "@/lib/repo/meals";
import { listPackages } from "@/lib/repo/orders";
import { PageHeader, Card, Field, Tabs } from "@/components/ui";
import { formatZar, pricingScenarios, packagePrice, priceForMargin, grossMargin } from "@/lib/costing";
import { saveSettingsAction, savePackageAction } from "@/app/actions";
import PricingCalculator from "@/components/PricingCalculator";

const TABS = [{ key: "assumptions", label: "Assumptions & calculator" }, { key: "menu", label: "Menu pricing review" }, { key: "packages", label: "Packages & subscriptions" }, { key: "corporate", label: "Corporate & family" }];

export default async function Pricing({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("finance:view");
  const { tab = "assumptions" } = await searchParams;
  const s = getAllSettings();
  const margins = { conservative: Number(s.target_margin_conservative), standard: Number(s.target_margin_standard), premium: Number(s.target_margin_premium) };
  const profiles = mealProfiles();
  const meals = listMeals();
  const avgPrice = profiles.length ? profiles.reduce((a, m) => a + m.price, 0) / profiles.length : 0;
  const avgCost = profiles.length ? profiles.reduce((a, m) => a + m.cost, 0) / profiles.length : 0;
  const edit = can(user, "finance:edit");
  return (
    <div>
      <PageHeader kicker="Finance" title="Pricing engine">No price is hard-coded. True cost = ingredients (best supplier price) + packaging + labour + overhead; recommended prices follow your margin scenarios and round to R5.</PageHeader>
      <Tabs tabs={TABS} active={tab} base="/pricing" />
      {tab === "assumptions" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Cost assumptions" kicker="Used by every meal cost">
            <form action={saveSettingsAction} className="grid grid-cols-2 gap-2">
              <Field label="Packaging per meal (R)"><input name="set_default_packaging_cost" type="number" step="0.1" defaultValue={s.default_packaging_cost} className="input" /></Field>
              <Field label="Labour rate (R/hour)"><input name="set_labour_rate_per_hour" type="number" step="1" defaultValue={s.labour_rate_per_hour} className="input" /></Field>
              <Field label="Overhead per meal (R)"><input name="set_overhead_per_meal" type="number" step="0.5" defaultValue={s.overhead_per_meal} className="input" /></Field>
              <Field label="Delivery per order (R)"><input name="set_delivery_cost_per_order" type="number" step="1" defaultValue={s.delivery_cost_per_order} className="input" /></Field>
              <Field label="Conservative margin"><input name="set_target_margin_conservative" type="number" step="0.01" min={0} max={0.95} defaultValue={s.target_margin_conservative} className="input" /></Field>
              <Field label="Standard margin"><input name="set_target_margin_standard" type="number" step="0.01" min={0} max={0.95} defaultValue={s.target_margin_standard} className="input" /></Field>
              <Field label="Premium margin"><input name="set_target_margin_premium" type="number" step="0.01" min={0} max={0.95} defaultValue={s.target_margin_premium} className="input" /></Field>
              <Field label="Default waste %"><input name="set_default_waste_pct" type="number" step="1" defaultValue={s.default_waste_pct} className="input" /></Field>
              {edit && <div className="col-span-2"><button className="btn-primary btn-sm">Save assumptions</button></div>}
            </form>
          </Card>
          <Card title="Pricing calculator" kicker="Interactive" className="lg:col-span-2"><PricingCalculator defaults={{ packaging: Number(s.default_packaging_cost), labourRate: Number(s.labour_rate_per_hour), overhead: Number(s.overhead_per_meal), margins }} /></Card>
          <Card title="Reference points" kicker="Starting estimates only — adjust to real supplier prices" className="lg:col-span-3">
            <table className="table"><thead><tr><th>Example</th><th>Cost</th><th>Conservative</th><th>Standard</th><th>Premium</th></tr></thead><tbody>{[["Basic meal", 45], ["Standard meal", 55], ["Premium meal", 65]].map(([n, c]) => { const sc = pricingScenarios(Number(c), margins); return <tr key={n}><td>{n}</td><td>{formatZar(Number(c))}</td>{sc.map((x) => <td key={x.name}>{formatZar(x.price)} <span className="text-xs text-ink-3">({Math.round(x.margin * 100)}%)</span></td>)}</tr>; })}<tr className="bg-bone-2/50"><td>Your menu average</td><td>{formatZar(avgCost)}</td>{pricingScenarios(avgCost, margins).map((x) => <td key={x.name}>{formatZar(x.price)}</td>)}</tr></tbody></table>
            <p className="text-xs text-ink-2 mt-2">Current average selling price {formatZar(avgPrice)} → average margin {avgPrice ? Math.round(((avgPrice - avgCost) / avgPrice) * 100) : 0}%.</p>
          </Card>
        </div>
      )}
      {tab === "menu" && (
        <Card title="Menu pricing review" kicker="Meals below the conservative margin are flagged">
          <table className="table"><thead><tr><th>Meal</th><th>Tier</th><th>True cost</th><th>Price</th><th>Profit</th><th>Margin</th><th>Conservative</th><th>Standard</th><th>Premium</th></tr></thead><tbody>{profiles.map((m) => { const g = grossMargin(m.price, m.cost); const low = g.margin_pct < margins.conservative * 100; return <tr key={m.id} className={low ? "bg-rose-50" : ""}><td className="font-medium"><a href={`/meals/${m.id}?tab=edit`} className="hover:underline">{m.name}</a></td><td className="text-xs">{meals.find((x) => x.id === m.id)?.tier}</td><td>{formatZar(m.cost)}</td><td>{formatZar(m.price)}</td><td>{formatZar(g.profit)}</td><td className={low ? "text-critical font-medium" : ""}>{g.margin_pct}%</td><td>{formatZar(priceForMargin(m.cost, margins.conservative))}</td><td>{formatZar(priceForMargin(m.cost, margins.standard))}</td><td>{formatZar(priceForMargin(m.cost, margins.premium))}</td></tr>; })}</tbody></table>
        </Card>
      )}
      {tab === "packages" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Packages" className="lg:col-span-2" kicker="Editable names, meals and prices">
            <table className="table"><thead><tr><th>Code</th><th>Name</th><th>Meals / week</th><th>Price / week</th><th>Per meal</th><th>Suggested (standard margin)</th><th>Monthly (×4)</th></tr></thead><tbody>{listPackages(false).map((p) => { const sug = packagePrice(p.meals_per_week, avgPrice, margins.standard); return <tr key={p.id} className={p.is_active ? "" : "opacity-50"}><td className="font-mono text-xs">{p.code}</td><td className="font-medium">{p.name}<div className="text-[11px] text-ink-2">{p.description}</div></td><td>{p.meals_per_week}{p.is_custom ? " (custom)" : ""}</td><td>{formatZar(p.price_zar)}</td><td>{formatZar(p.price_zar / p.meals_per_week)}</td><td className="text-xs">{formatZar(sug.price)} <span className="text-ink-3">({Math.round(sug.discount_pct * 100)}% volume discount)</span></td><td>{formatZar(p.price_zar * 4)}</td></tr>; })}</tbody></table>
            <p className="text-xs text-ink-2 mt-2">Volume discounts: 10+ meals 5 %, 14+ 8 %, 21+ 12 %, 28+ 15 % — capped at half the standard margin so bundles never destroy profitability.</p>
          </Card>
          {can(user, "settings:edit") && <Card title="Add / edit package"><form action={savePackageAction} className="grid grid-cols-2 gap-2"><Field label="ID (blank = new)"><input name="id" type="number" className="input" /></Field><Field label="Code"><input name="code" className="input" required /></Field><Field label="Name" className="col-span-2"><input name="name" className="input" required /></Field><Field label="Description" className="col-span-2"><input name="description" className="input" /></Field><Field label="Meals / week"><input name="meals_per_week" type="number" className="input" required /></Field><Field label="Price / week (R)"><input name="price_zar" type="number" className="input" required /></Field><Field label="Sort"><input name="sort_order" type="number" defaultValue={9} className="input" /></Field><div className="flex flex-col gap-1 text-sm"><label className="flex items-center gap-2"><input type="checkbox" name="is_custom" /> Custom quantity</label><label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked /> Active</label></div><div><button className="btn-primary btn-sm">Save package</button></div></form></Card>}
        </div>
      )}
      {tab === "corporate" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Corporate pricing" kicker="Volume + single drop-off">
            <table className="table"><thead><tr><th>Employees</th><th>Lunches / week</th><th>List</th><th>Corporate (−10 % + shared delivery)</th><th>Margin at avg cost</th></tr></thead><tbody>{[5, 10, 20, 50].map((n) => { const meals = n * 5; const list = meals * avgPrice; const corp = Math.round(list * 0.9 / 5) * 5; const margin = corp ? Math.round(((corp - meals * avgCost) / corp) * 100) : 0; return <tr key={n}><td>{n}</td><td>{meals}</td><td>{formatZar(list)}</td><td className="font-medium">{formatZar(corp)}</td><td className={margin < margins.conservative * 100 ? "text-critical" : ""}>{margin}%</td></tr>; })}</tbody></table>
            <p className="text-xs text-ink-2 mt-2">A single delivery address removes per-order delivery cost, which funds the discount.</p>
          </Card>
          <Card title="Family packages" kicker="Portion multiplier">
            <table className="table"><thead><tr><th>Household</th><th>Dinners / week</th><th>Portions</th><th>Price (2nd+ portion −15 %)</th></tr></thead><tbody>{[2, 3, 4].map((n) => { const dinners = 5; const portions = dinners * n; const price = Math.round((dinners * avgPrice + dinners * (n - 1) * avgPrice * 0.85) / 5) * 5; return <tr key={n}><td>{n} people</td><td>{dinners}</td><td>{portions}</td><td className="font-medium">{formatZar(price)} / week</td></tr>; })}</tbody></table>
            <p className="text-xs text-ink-2 mt-2">Extra portions of the same meal carry no extra labour or planning cost, so a 15 % discount keeps margin intact.</p>
          </Card>
          <Card title="Custom meal-plan pricing" className="lg:col-span-2"><p className="text-sm text-ink-2">Premium custom = package price + planner time. Suggested: add R{Math.round(Number(s.labour_rate_per_hour) * 1.5)} (1.5 h of planning at your labour rate) per week for a fully personalised plan with weekly check-ins. Edit the PREMIUM package to reflect this.</p></Card>
        </div>
      )}
    </div>
  );
}
