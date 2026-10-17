import { requirePermission, can } from "@/lib/auth";
import { listIngredients, bestPrices, stockByIngredient } from "@/lib/repo/meals";
import { PageHeader, Card, Field } from "@/components/ui";
import { INGREDIENT_CATEGORIES, INGREDIENT_CATEGORY_LABELS, ALLERGENS, ALLERGEN_LABELS, parseJson } from "@/lib/types";
import { formatZar } from "@/lib/costing";
import { formatQty } from "@/lib/grocery";
import { saveIngredient } from "@/app/actions";

export default async function Ingredients({ searchParams }: { searchParams: Promise<{ edit?: string; category?: string }> }) {
  const user = await requirePermission("meals:view");
  const { edit, category } = await searchParams;
  const rows = listIngredients(false).filter((i) => !category || i.category === category);
  const prices = bestPrices();
  const stock = stockByIngredient();
  const editing = edit ? rows.find((r) => r.id === Number(edit)) : undefined;
  return (
    <div>
      <PageHeader kicker="Catalogue" title="Ingredients">Nutrition per 100 g/ml, allergens, waste allowance and the price the costing engine uses (best supplier price, else default).</PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title={`${rows.length} ingredients`} action={<form className="flex gap-2"><select name="category" defaultValue={category ?? ""} className="input"><option value="">All</option>{INGREDIENT_CATEGORIES.map((c) => <option key={c} value={c}>{INGREDIENT_CATEGORY_LABELS[c]}</option>)}</select><button className="btn-secondary btn-sm">Filter</button></form>}>
          <div className="overflow-x-auto"><table className="table"><thead><tr><th>Ingredient</th><th>Category</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th>Allergens</th><th>Price/unit</th><th>Stock</th><th></th></tr></thead><tbody>{rows.map((i) => <tr key={i.id}><td className="font-medium">{i.name}</td><td className="text-xs text-ink-2">{INGREDIENT_CATEGORY_LABELS[i.category]}</td><td>{i.kcal_per_100}</td><td>{i.protein_per_100}</td><td>{i.carbs_per_100}</td><td>{i.fat_per_100}</td><td className="text-xs">{parseJson<string[]>(i.allergens, []).map((a) => ALLERGEN_LABELS[a] ?? a).join(", ")}</td><td className="text-xs">{formatZar((prices.get(i.id)?.price ?? 0) * (i.base_unit === "each" ? 1 : 1000))}/{i.base_unit === "each" ? "each" : i.base_unit === "g" ? "kg" : "L"}</td><td className="text-xs">{formatQty(stock.get(i.id) ?? 0, i.base_unit)}</td><td>{can(user, "meals:edit") && <a href={`/ingredients?edit=${i.id}`} className="btn-ghost btn-sm">Edit</a>}</td></tr>)}</tbody></table></div>
        </Card>
        {can(user, "meals:edit") && (
          <Card title={editing ? `Edit ${editing.name}` : "Add ingredient"}>
            <form action={saveIngredient} className="grid grid-cols-2 gap-2">
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <Field label="Name" className="col-span-2"><input name="name" defaultValue={editing?.name ?? ""} className="input" required /></Field>
              <Field label="Category"><select name="category" defaultValue={editing?.category ?? "vegetables"} className="input">{INGREDIENT_CATEGORIES.map((c) => <option key={c} value={c}>{INGREDIENT_CATEGORY_LABELS[c]}</option>)}</select></Field>
              <Field label="Base unit"><select name="base_unit" defaultValue={editing?.base_unit ?? "g"} className="input">{["g", "ml", "each"].map((u) => <option key={u}>{u}</option>)}</select></Field>
              {(["kcal_per_100", "protein_per_100", "carbs_per_100", "fat_per_100", "fibre_per_100", "sodium_mg_per_100", "sugar_per_100"] as const).map((k) => <Field key={k} label={k.replace(/_per_100/, "").replace("_", " ") + " /100"}><input name={k} type="number" step="0.1" defaultValue={editing?.[k] ?? 0} className="input" /></Field>)}
              <Field label="Default cost per unit (R)" hint="per g / ml / each"><input name="default_cost_per_unit" type="number" step="0.0001" defaultValue={editing?.default_cost_per_unit ?? 0} className="input" /></Field>
              <Field label="Waste %"><input name="waste_pct" type="number" step="1" defaultValue={editing?.waste_pct ?? 5} className="input" /></Field>
              <Field label="Minimum stock"><input name="min_stock" type="number" defaultValue={editing?.min_stock ?? 0} className="input" /></Field>
              <Field label="Storage"><select name="storage" defaultValue={editing?.storage ?? "chilled"} className="input">{["ambient", "chilled", "frozen"].map((u) => <option key={u}>{u}</option>)}</select></Field>
              <div className="col-span-2"><span className="label">Allergens</span><div className="flex flex-wrap gap-2 text-xs">{ALLERGENS.map((a) => <label key={a} className="flex items-center gap-1"><input type="checkbox" name="allergens" value={a} defaultChecked={parseJson<string[]>(editing?.allergens, []).includes(a)} />{ALLERGEN_LABELS[a]}</label>)}</div></div>
              <div className="col-span-2 flex gap-2"><button className="btn-primary btn-sm">Save</button>{editing && <a href="/ingredients" className="btn-secondary btn-sm">Cancel</a>}</div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
