import { Field } from "@/components/ui";
import { MEAL_CATEGORIES, DIETARY_TAGS, type MealRow, parseJson } from "@/lib/types";
import { prettyTag } from "@/lib/recommend";

export default function MealForm({ meal, action }: { meal?: MealRow; action: (fd: FormData) => Promise<void> }) {
  const tags = parseJson<string[]>(meal?.dietary_tags, []);
  const ov = parseJson<Record<string, number>>(meal?.nutrition_override, {});
  return (
    <form action={action} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {meal && <input type="hidden" name="id" value={meal.id} />}
      <Field label="Name" className="lg:col-span-2"><input name="name" defaultValue={meal?.name ?? ""} className="input" required /></Field>
      <Field label="Category"><select name="category" defaultValue={meal?.category ?? "lunch"} className="input">{MEAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Cuisine"><input name="cuisine" defaultValue={meal?.cuisine ?? ""} className="input" /></Field>
      <Field label="Description" className="lg:col-span-4"><textarea name="description" rows={2} defaultValue={meal?.description ?? ""} className="input" /></Field>
      <Field label="Recipe yield (servings)"><input name="servings" type="number" min={1} defaultValue={meal?.servings ?? 4} className="input" /></Field>
      <Field label="Serving size (g)"><input name="serving_size_g" type="number" defaultValue={meal?.serving_size_g ?? 400} className="input" /></Field>
      <Field label="Prep (min)"><input name="prep_minutes" type="number" defaultValue={meal?.prep_minutes ?? 15} className="input" /></Field>
      <Field label="Cook (min)"><input name="cook_minutes" type="number" defaultValue={meal?.cook_minutes ?? 30} className="input" /></Field>
      <Field label="Cook temp (°C)"><input name="cook_temp_c" type="number" defaultValue={meal?.cook_temp_c ?? ""} className="input" /></Field>
      <Field label="Shelf life (days)"><input name="shelf_life_days" type="number" defaultValue={meal?.shelf_life_days ?? 4} className="input" /></Field>
      <Field label="Complexity (1–5)"><input name="complexity" type="number" min={1} max={5} defaultValue={meal?.complexity ?? 2} className="input" /></Field>
      <Field label="Internal rating (1–5)"><input name="internal_rating" type="number" min={1} max={5} defaultValue={meal?.internal_rating ?? 4} className="input" /></Field>
      <Field label="Selling price (R)"><input name="selling_price" type="number" step="0.5" defaultValue={meal?.selling_price ?? 0} className="input" /></Field>
      <Field label="Tier"><select name="tier" defaultValue={meal?.tier ?? "standard"} className="input">{["basic", "standard", "premium"].map((t) => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Packaging cost override (R)" hint="0 = use business default"><input name="packaging_cost" type="number" step="0.1" defaultValue={meal?.packaging_cost ?? 0} className="input" /></Field>
      <Field label="Labour min / serving"><input name="labour_minutes_per_serving" type="number" step="0.5" defaultValue={meal?.labour_minutes_per_serving ?? 4} className="input" /></Field>
      <Field label="Storage" className="lg:col-span-2"><input name="storage" defaultValue={meal?.storage ?? "Keep refrigerated at or below 4°C."} className="input" /></Field>
      <Field label="Reheating" className="lg:col-span-2"><input name="reheating" defaultValue={meal?.reheating ?? "Microwave 2–3 min until piping hot (75°C core)."} className="input" /></Field>
      <Field label="Food safety notes" className="lg:col-span-2"><input name="food_safety_notes" defaultValue={meal?.food_safety_notes ?? ""} className="input" /></Field>
      <Field label="Image URL" className="lg:col-span-2"><input name="image_url" defaultValue={meal?.image_url ?? ""} className="input" /></Field>
      <div className="lg:col-span-4"><span className="label">Dietary tags</span><div className="flex flex-wrap gap-3 text-sm">{DIETARY_TAGS.map((t) => <label key={t} className="flex items-center gap-1.5"><input type="checkbox" name="dietary_tags" value={t} defaultChecked={tags.includes(t)} />{prettyTag(t)}</label>)}</div></div>
      <div className="lg:col-span-4"><span className="label">Nutrition overrides per serving (leave blank to derive from recipe)</span><div className="grid grid-cols-5 gap-2">{["kcal", "protein", "carbs", "fat", "fibre"].map((k) => <input key={k} name={`ov_${k}`} type="number" step="0.1" placeholder={k} defaultValue={ov[k] ?? ""} className="input" />)}</div></div>
      <div className="flex gap-4 text-sm lg:col-span-4">
        <label className="flex items-center gap-2"><input type="checkbox" name="bulk_friendly" defaultChecked={meal ? !!meal.bulk_friendly : true} /> Bulk-friendly</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="is_active" defaultChecked={meal ? !!meal.is_active : true} /> Active on menu</label>
      </div>
      <div><button className="btn-primary">Save meal</button></div>
    </form>
  );
}
