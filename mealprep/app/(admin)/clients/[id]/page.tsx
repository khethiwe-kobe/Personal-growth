import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/auth";
import { getClientFull, clientTimeline, listProgress, clientPrefsParsed, exportClientData } from "@/lib/repo/clients";
import { clientContext, listPlans, listOrders, listSubscriptions } from "@/lib/repo/orders";
import { mealProfiles } from "@/lib/repo/meals";
import { recommend, excluded, suggestSubstitutions } from "@/lib/recommend";
import { ageFromDob, ACTIVITY_LABELS, PROFESSIONAL_REVIEW_MESSAGE } from "@/lib/nutrition";
import { GOAL_LABELS, DIETARY_TAGS, ALLERGENS, ALLERGEN_LABELS, SLOTS, type GoalType } from "@/lib/types";
import { PageHeader, Card, StatusBadge, Tabs, Disclaimer, fmtDate, Field, Empty, NutritionRow, Stat } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { updateClientPersonal, updateClientHealth, updateClientPreferences, addProfessionalReview, anonymiseClientAction, addProgressAction } from "@/app/actions";
import { formatZar } from "@/lib/costing";
import { prettyTag } from "@/lib/recommend";

const TABS = [{ key: "overview", label: "Overview" }, { key: "nutrition", label: "Nutrition analysis" }, { key: "recommend", label: "Recommendations" }, { key: "plans", label: "Plans & orders" }, { key: "progress", label: "Progress" }, { key: "timeline", label: "Timeline" }, { key: "privacy", label: "Privacy & data" }];

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("clients:view");
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const full = getClientFull(Number(id));
  if (!full) notFound();
  const { client: c, health: h, prefs, allergies, goals, computed: t } = full;
  const p = clientPrefsParsed(prefs);
  const age = ageFromDob(c.date_of_birth);
  const canEditHealth = can(user, "health:edit");
  const approved = full.reviews.some((r) => r.outcome.startsWith("approved"));
  const reviewPending = t.requires_professional_review && !approved;
  const goal = goals.find((g) => g.is_primary) ?? goals[0];

  return (
    <div>
      <PageHeader kicker={`Client #${c.id} · ${c.status}`} title={`${c.first_name} ${c.last_name}`} actions={<>
        <Link href={`/meal-plans/new?client=${c.id}`} className="btn-primary btn-sm">Generate meal plan</Link>
        <Link href={`/api/export/client/${c.id}`} className="btn-secondary btn-sm">Export data</Link>
      </>}>
        {age ?? "—"} yrs · {c.gender} · {c.email} · {c.phone}{goal ? ` · Goal: ${GOAL_LABELS[goal.goal_type as GoalType] ?? goal.goal_type}` : ""}
      </PageHeader>
      {reviewPending && <div className="rounded-xl border border-critical/30 bg-rose-50 text-rose-900 text-sm px-4 py-3 mb-4"><b>{PROFESSIONAL_REVIEW_MESSAGE}</b> Flags: {t.flags.filter((f) => f.severity === "critical").map((f) => f.message).join(" ")}</div>}
      <Tabs tabs={TABS} active={tab} base={`/clients/${c.id}`} />

      {tab === "overview" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Personal information" className="lg:col-span-2">
            <form action={updateClientPersonal} className="grid sm:grid-cols-2 gap-3">
              <input type="hidden" name="id" value={c.id} />
              <Field label="First name"><input name="first_name" defaultValue={c.first_name} className="input" required /></Field>
              <Field label="Last name"><input name="last_name" defaultValue={c.last_name} className="input" required /></Field>
              <Field label="Email"><input name="email" type="email" defaultValue={c.email} className="input" /></Field>
              <Field label="Phone"><input name="phone" defaultValue={c.phone} className="input" /></Field>
              <Field label="Date of birth"><input name="date_of_birth" type="date" defaultValue={c.date_of_birth ?? ""} className="input" /></Field>
              <Field label="Gender"><select name="gender" defaultValue={c.gender} className="input">{["female", "male", "other", "unspecified"].map((g) => <option key={g}>{g}</option>)}</select></Field>
              <Field label="Address" className="sm:col-span-2"><input name="address" defaultValue={c.address} className="input" /></Field>
              <Field label="Delivery address" className="sm:col-span-2"><input name="delivery_address" defaultValue={c.delivery_address} className="input" /></Field>
              <Field label="Delivery notes"><input name="delivery_notes" defaultValue={c.delivery_notes} className="input" /></Field>
              <Field label="Emergency contact"><input name="emergency_contact" defaultValue={c.emergency_contact} className="input" /></Field>
              <Field label="Status"><select name="status" defaultValue={c.status} className="input">{["lead", "onboarding", "active", "paused", "churned"].map((g) => <option key={g}>{g}</option>)}</select></Field>
              <Field label="Acquisition source"><input name="source" defaultValue={c.source} className="input" /></Field>
              <Field label="Internal notes" className="sm:col-span-2"><textarea name="notes" defaultValue={c.notes} className="input" rows={2} /></Field>
              <div className="sm:col-span-2">{can(user, "clients:edit") && <button className="btn-primary btn-sm">Save personal details</button>}</div>
            </form>
          </Card>
          <div className="space-y-4">
            <Card title="Snapshot" kicker="Nutrition profile">
              <dl className="text-sm grid grid-cols-2 gap-y-1.5">
                <dt className="text-ink-2">Height</dt><dd>{h?.height_cm ?? "—"} cm</dd>
                <dt className="text-ink-2">Weight</dt><dd>{h?.weight_kg ?? "—"} kg{h?.target_weight_kg ? ` → ${h.target_weight_kg} kg` : ""}</dd>
                <dt className="text-ink-2">BMI</dt><dd>{t.bmi ?? "—"} <span className="text-xs text-ink-3">{t.bmi_category}</span></dd>
                <dt className="text-ink-2">Activity</dt><dd className="capitalize">{(h?.activity_level ?? "").replace("_", " ")}</dd>
                <dt className="text-ink-2">Blood type</dt><dd>{h?.blood_type || "—"} <span className="text-[10px] text-ink-3">informational only</span></dd>
                <dt className="text-ink-2">Calorie target</dt><dd>{t.calories_target ?? "—"} kcal</dd>
                <dt className="text-ink-2">Protein</dt><dd>{t.protein_g ?? "—"} g</dd>
                <dt className="text-ink-2">Carbs</dt><dd>{t.carbs_min_g ?? "—"}–{t.carbs_max_g ?? "—"} g</dd>
                <dt className="text-ink-2">Fat</dt><dd>{t.fat_min_g ?? "—"}–{t.fat_max_g ?? "—"} g</dd>
                <dt className="text-ink-2">Fibre</dt><dd>{t.fibre_g} g</dd>
                <dt className="text-ink-2">Water</dt><dd>{t.water_ml ? (t.water_ml / 1000).toFixed(1) : "—"} L</dd>
                <dt className="text-ink-2">Pattern</dt><dd>{prefs?.dietary_pattern}</dd>
                <dt className="text-ink-2">Meals/day</dt><dd>{prefs?.meals_per_day}{prefs?.include_snacks ? " + snacks" : ""}</dd>
                <dt className="text-ink-2">Budget</dt><dd>{prefs?.budget_per_meal_zar ? formatZar(prefs.budget_per_meal_zar) + "/meal" : "—"}</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">{allergies.map((a) => <span key={a.id} className={`badge ${a.kind === "allergy" ? "bg-rose-100 text-rose-900" : "bg-amber-100 text-amber-900"}`}>{a.kind}: {ALLERGEN_LABELS[a.allergen] ?? a.allergen} ({a.severity})</span>)}{p.dietary_tags.map((x) => <span key={x} className="badge bg-bone-2 text-ink-2">{prettyTag(x)}</span>)}</div>
            </Card>
            <Card title="Subscriptions" kicker="Recurring">
              {listSubscriptions(c.id).length === 0 ? <Empty>No subscription. <Link href="/subscriptions" className="text-accent">Create one</Link></Empty> : listSubscriptions(c.id).map((s) => <div key={s.id} className="text-sm flex justify-between py-1"><span>{s.package_name ?? "Custom"} · {s.meals_per_week}/wk · {s.frequency}</span><StatusBadge status={s.status} /></div>)}
            </Card>
          </div>
          <Card title="Health & lifestyle" kicker="Special personal information (POPIA)" className="lg:col-span-3">
            <form action={updateClientHealth} className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Height (cm)"><input name="height_cm" type="number" step="0.1" defaultValue={h?.height_cm ?? ""} className="input" /></Field>
              <Field label="Weight (kg)"><input name="weight_kg" type="number" step="0.1" defaultValue={h?.weight_kg ?? ""} className="input" /></Field>
              <Field label="Target weight (kg)"><input name="target_weight_kg" type="number" step="0.1" defaultValue={h?.target_weight_kg ?? ""} className="input" /></Field>
              <Field label="Activity level"><select name="activity_level" defaultValue={h?.activity_level ?? "moderate"} className="input">{Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Primary goal"><select name="goal_type" defaultValue={goal?.goal_type ?? "balanced"} className="input">{Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="Goal description"><input name="goal_description" defaultValue={goal?.description ?? ""} className="input" /></Field>
              <Field label="Goal target date"><input name="goal_target_date" type="date" defaultValue={goal?.target_date ?? ""} className="input" /></Field>
              <Field label="Fitness level"><select name="fitness_level" defaultValue={h?.fitness_level ?? "beginner"} className="input">{["beginner", "intermediate", "advanced", "athlete"].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Blood type" hint="Recorded for information only; never used in calculations."><input name="blood_type" defaultValue={h?.blood_type ?? ""} className="input" /></Field>
              <Field label="Training schedule"><input name="training_schedule" defaultValue={h?.training_schedule ?? ""} className="input" /></Field>
              <Field label="Lifestyle"><input name="lifestyle" defaultValue={h?.lifestyle ?? ""} className="input" /></Field>
              <Field label="Sleep (hours)"><input name="sleep_hours" type="number" step="0.5" defaultValue={h?.sleep_hours ?? ""} className="input" /></Field>
              <Field label="Water (litres/day)"><input name="water_litres" type="number" step="0.5" defaultValue={h?.water_litres ?? ""} className="input" /></Field>
              <Field label="Stress level"><select name="stress_level" defaultValue={h?.stress_level ?? ""} className="input"><option value="">—</option>{["low", "medium", "high"].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Medical conditions" hint="Any entry triggers a professional-review flag." className="sm:col-span-2"><input name="medical_conditions" defaultValue={h?.medical_conditions ?? ""} className="input" /></Field>
              <Field label="Medications"><input name="medications" defaultValue={h?.medications ?? ""} className="input" /></Field>
              <Field label="Medically restricted diet"><input name="medically_restricted_diet" defaultValue={h?.medically_restricted_diet ?? ""} className="input" /></Field>
              <div className="flex flex-wrap gap-4 sm:col-span-3 lg:col-span-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" name="is_pregnant" defaultChecked={!!h?.is_pregnant} /> Pregnant</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="is_breastfeeding" defaultChecked={!!h?.is_breastfeeding} /> Breastfeeding</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="eating_disorder_history" defaultChecked={!!h?.eating_disorder_history} /> Eating-disorder history</label>
              </div>
              <Field label="Other notes" className="sm:col-span-3 lg:col-span-4"><textarea name="other_notes" defaultValue={h?.other_notes ?? ""} className="input" rows={2} /></Field>
              <div>{canEditHealth && <button className="btn-primary btn-sm">Save & recompute targets</button>}</div>
            </form>
          </Card>
          <Card title="Food preferences, allergies & intolerances" className="lg:col-span-3">
            <form action={updateClientPreferences} className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Dietary pattern"><select name="dietary_pattern" defaultValue={prefs?.dietary_pattern ?? "omnivore"} className="input">{["omnivore", "pescatarian", "vegetarian", "vegan", "halal", "kosher", "other"].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Meals per day"><select name="meals_per_day" defaultValue={prefs?.meals_per_day ?? 3} className="input">{[1, 2, 3].map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
              <Field label="People served"><input name="people_served" type="number" min={1} defaultValue={prefs?.people_served ?? 1} className="input" /></Field>
              <Field label="Cooking preference"><select name="cooking_preference" defaultValue={prefs?.cooking_preference ?? "ready_to_heat"} className="input">{["ready_to_heat", "some_assembly", "cook_at_home"].map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</select></Field>
              <Field label="Spice level"><select name="spice_level" defaultValue={prefs?.spice_level ?? "medium"} className="input">{["mild", "medium", "hot"].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Budget per meal (R)"><input name="budget_per_meal_zar" type="number" defaultValue={prefs?.budget_per_meal_zar ?? ""} className="input" /></Field>
              <Field label="Budget per week (R)"><input name="budget_per_week_zar" type="number" defaultValue={prefs?.budget_per_week_zar ?? ""} className="input" /></Field>
              <label className="flex items-center gap-2 text-sm mt-5"><input type="checkbox" name="include_snacks" defaultChecked={!!(prefs?.include_snacks ?? 1)} /> Include snacks</label>
              <Field label="Cuisines (comma separated)" className="sm:col-span-2"><input name="cuisines" defaultValue={p.cuisines.join(", ")} className="input" /></Field>
              <Field label="Liked foods"><input name="liked_foods" defaultValue={p.liked.join(", ")} className="input" /></Field>
              <Field label="Disliked foods"><input name="disliked_foods" defaultValue={p.disliked.join(", ")} className="input" /></Field>
              <div className="sm:col-span-3 lg:col-span-4"><span className="label">Dietary tags</span><div className="flex flex-wrap gap-3 text-sm">{DIETARY_TAGS.map((x) => <label key={x} className="flex items-center gap-1.5"><input type="checkbox" name="dietary_tags" value={x} defaultChecked={p.dietary_tags.includes(x)} />{prettyTag(x)}</label>)}</div></div>
              <div className="sm:col-span-3 lg:col-span-4"><span className="label">Preferred delivery days</span><div className="flex flex-wrap gap-3 text-sm">{["mon", "tue", "wed", "thu", "fri", "sat"].map((x) => <label key={x} className="flex items-center gap-1.5"><input type="checkbox" name="delivery_days" value={x} defaultChecked={p.delivery_days.includes(x)} />{x}</label>)}</div></div>
              <div className="sm:col-span-3 lg:col-span-4">
                <span className="label">Allergies, intolerances and foods to avoid</span>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, k) => { const a = allergies[k]; return (
                    <div key={k} className="flex gap-1">
                      <select name={`kind_${k}`} defaultValue={a?.kind ?? "allergy"} className="input !w-28">{["allergy", "intolerance", "avoid", "medical"].map((x) => <option key={x}>{x}</option>)}</select>
                      <input name={`allergen_${k}`} defaultValue={a?.allergen ?? ""} list="allergen-list" placeholder="allergen" className="input" />
                      <select name={`severity_${k}`} defaultValue={a?.severity ?? "moderate"} className="input !w-24">{["mild", "moderate", "severe"].map((x) => <option key={x}>{x}</option>)}</select>
                    </div>); })}
                </div>
                <datalist id="allergen-list">{ALLERGENS.map((a) => <option key={a} value={a}>{ALLERGEN_LABELS[a]}</option>)}</datalist>
              </div>
              <div>{canEditHealth && <button className="btn-primary btn-sm">Save preferences</button>}</div>
            </form>
          </Card>
        </div>
      )}

      {tab === "nutrition" && (
        <div className="space-y-4">
          <Disclaimer />
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
            <Stat label="BMI" value={t.bmi ?? "—"} sub={t.bmi_category} />
            <Stat label="BMR (Mifflin-St Jeor)" value={t.bmr ?? "—"} sub="kcal at rest" />
            <Stat label="Estimated energy need" value={t.tdee ?? "—"} sub={`× ${h ? ({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 } as Record<string, number>)[h.activity_level] : "—"} activity`} />
            <Stat label="Calorie range" value={t.calories_target ?? "—"} sub={`${t.calories_min ?? "—"}–${t.calories_max ?? "—"} kcal/day`} />
            <Stat label="Protein" value={`${t.protein_g ?? "—"} g`} sub="per day" />
            <Stat label="Water" value={t.water_ml ? `${(t.water_ml / 1000).toFixed(1)} L` : "—"} sub="≈ 35 ml/kg" />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Macronutrient ranges" kicker="Daily">
              <table className="table"><tbody>
                <tr><td>Protein</td><td className="text-right">{t.protein_g ?? "—"} g</td></tr>
                <tr><td>Carbohydrate</td><td className="text-right">{t.carbs_min_g ?? "—"}–{t.carbs_max_g ?? "—"} g</td></tr>
                <tr><td>Fat</td><td className="text-right">{t.fat_min_g ?? "—"}–{t.fat_max_g ?? "—"} g</td></tr>
                <tr><td>Fibre</td><td className="text-right">{t.fibre_g} g</td></tr>
              </tbody></table>
              <ul className="text-xs text-ink-2 mt-3 list-disc pl-4 space-y-1">{t.goal_notes.map((g) => <li key={g}>{g}</li>)}<li>Deficits are capped at 15–20 % and never go below 1,200 kcal (female) / 1,500 kcal (male or unspecified).</li></ul>
            </Card>
            <Card title="Meal distribution" kicker="Energy per slot">
              <table className="table"><tbody>{t.meal_distribution.map((d) => <tr key={d.slot}><td className="capitalize">{d.slot}</td><td className="text-right">{Math.round(d.share * 100)}%</td><td className="text-right">{d.kcal ?? "—"} kcal</td></tr>)}</tbody></table>
            </Card>
            <Card title="Safety flags" kicker={t.flags.length ? `${t.flags.length} flag(s)` : "None"}>
              {t.flags.length === 0 ? <p className="text-sm text-ink-2">No safety flags. Personalised recommendations can proceed with general nutrition guidance.</p> : (
                <ul className="text-sm space-y-2">{t.flags.map((f) => <li key={f.code} className={`rounded-lg px-3 py-2 ${f.severity === "critical" ? "bg-rose-50 text-rose-900" : f.severity === "warning" ? "bg-amber-50 text-amber-900" : "bg-bone-2"}`}>{f.message}</li>)}</ul>
              )}
              {reviewPending && <p className="text-xs text-rose-900 mt-3 font-medium">{PROFESSIONAL_REVIEW_MESSAGE}</p>}
            </Card>
            <Card title="Professional review" kicker="Dietitian / doctor sign-off" className="lg:col-span-3">
              <div className="grid lg:grid-cols-2 gap-4">
                <div>
                  {full.reviews.length === 0 ? <Empty>No reviews recorded.</Empty> : <ul className="text-sm divide-y divide-line">{full.reviews.map((r) => <li key={r.id} className="py-2"><div className="flex justify-between"><span><b>{r.reviewer_name}</b> <span className="text-ink-3">{r.reviewer_role}</span></span><StatusBadge status={r.outcome} /></div><div className="text-xs text-ink-2">{r.notes}</div><div className="text-[11px] text-ink-3">{fmtDate(r.reviewed_at ?? r.created_at)}</div></li>)}</ul>}
                </div>
                {canEditHealth && (
                  <form action={addProfessionalReview} className="grid grid-cols-2 gap-2">
                    <input type="hidden" name="client_id" value={c.id} />
                    <Field label="Reviewer name"><input name="reviewer_name" className="input" required /></Field>
                    <Field label="Role"><select name="reviewer_role" className="input">{["registered dietitian", "doctor", "nurse", "other"].map((x) => <option key={x}>{x}</option>)}</select></Field>
                    <Field label="Outcome"><select name="outcome" className="input">{["pending", "approved", "approved_with_limits", "declined"].map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}</select></Field>
                    <Field label="Notes" className="col-span-2"><textarea name="notes" className="input" rows={2} /></Field>
                    <div><button className="btn-primary btn-sm">Record review</button></div>
                  </form>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "recommend" && <Recommendations clientId={c.id} reviewPending={reviewPending} />}

      {tab === "plans" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Meal plans" action={<Link href={`/meal-plans/new?client=${c.id}`} className="btn-primary btn-sm">New plan</Link>}>
            {listPlans(c.id).length === 0 ? <Empty>No plans yet.</Empty> : <table className="table"><thead><tr><th>Week</th><th>Items</th><th>Status</th><th></th></tr></thead><tbody>{listPlans(c.id).map((pl) => <tr key={pl.id}><td>{fmtDate(pl.week_start)}</td><td>{pl.items}</td><td><StatusBadge status={pl.status} /></td><td><Link href={`/meal-plans/${pl.id}`} className="btn-ghost btn-sm">Open</Link></td></tr>)}</tbody></table>}
          </Card>
          <Card title="Orders">
            {listOrders({ clientId: c.id }).length === 0 ? <Empty>No orders yet.</Empty> : <table className="table"><thead><tr><th>Order</th><th>Delivery</th><th>Total</th><th>Status</th></tr></thead><tbody>{listOrders({ clientId: c.id }).map((o) => <tr key={o.id}><td><Link href={`/orders/${o.id}`} className="hover:underline">{o.order_number}</Link></td><td>{fmtDate(o.delivery_date)}</td><td>{formatZar(o.total_zar)}</td><td><StatusBadge status={o.status} /></td></tr>)}</tbody></table>}
          </Card>
        </div>
      )}

      {tab === "progress" && <ProgressTab clientId={c.id} />}

      {tab === "timeline" && (
        <Card title="Client timeline">
          <ol className="relative border-l border-line ml-2 space-y-4">{clientTimeline(c.id).map((e, i) => <li key={i} className="pl-5"><span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-accent/80 border-2 border-white" /><div className="text-[11px] text-ink-3">{fmtDate(e.at)} · {e.kind}</div><div className="text-sm font-medium">{e.link ? <Link href={e.link} className="hover:underline">{e.title}</Link> : e.title}</div>{e.detail && <div className="text-xs text-ink-2">{e.detail}</div>}</li>)}</ol>
        </Card>
      )}

      {tab === "privacy" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Consent record" kicker="POPIA">
            <table className="table"><thead><tr><th>Consent</th><th>Version</th><th>Granted</th><th>Date</th></tr></thead><tbody>{(exportClientData(c.id).client_consents as { consent_type: string; version: string; granted: number; granted_at: string }[]).map((x, i) => <tr key={i}><td>{x.consent_type.replace("_", " ")}</td><td>{x.version}</td><td>{x.granted ? "yes" : "no"}</td><td>{fmtDate(x.granted_at)}</td></tr>)}</tbody></table>
            <p className="text-xs text-ink-2 mt-3">Health and nutrition information is treated as special personal information. Access is role-restricted and every change is written to the audit log.</p>
          </Card>
          <Card title="Data subject rights">
            <p className="text-sm text-ink-2">Export produces a JSON file with every record held about this client. Deletion anonymises personal and health data while preserving financial records required for accounting.</p>
            <div className="flex gap-2 mt-4">
              <Link href={`/api/export/client/${c.id}`} className="btn-secondary btn-sm">Download data export (JSON)</Link>
              {can(user, "clients:edit") && <form action={anonymiseClientAction}><input type="hidden" name="client_id" value={c.id} /><button className="btn-secondary btn-sm !text-critical">Anonymise & delete personal data</button></form>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Recommendations({ clientId, reviewPending }: { clientId: number; reviewPending: boolean }) {
  const { ctx } = clientContext(clientId);
  const meals = mealProfiles(clientId);
  const ex = excluded(meals, ctx);
  const subs = suggestSubstitutions(ex.flatMap((e) => e.meal.ingredient_names), ctx).filter((v, i, a) => a.findIndex((x) => x.ingredient === v.ingredient && x.suggest === v.suggest) === i).slice(0, 8);
  return (
    <div className="space-y-4">
      <Disclaimer text={reviewPending ? "Preliminary suggestions only. This client is flagged for professional review; recommendations must not be presented as personalised advice until a professional has signed off." : undefined} />
      {SLOTS.map((slot) => {
        const recs = recommend(meals, ctx, slot, 4);
        return (
          <Card key={slot} title={<span className="capitalize">{slot} options</span>} kicker={`Allowance ~${ctx.slot_kcal[slot] ?? "—"} kcal`}>
            {recs.length === 0 ? <Empty>No compatible meals.</Empty> : (
              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                {recs.map((r) => (
                  <div key={r.meal.id} className="rounded-xl border border-line p-3">
                    <div className="flex justify-between items-start gap-2"><Link href={`/meals/${r.meal.id}`} className="font-medium text-sm hover:underline">{r.meal.name}</Link><span className="badge bg-ink text-white">{r.score}</span></div>
                    <div className="mt-1"><NutritionRow n={r.meal.nutrition} compact /></div>
                    <div className="text-xs text-ink-3 mt-1">{formatZar(r.meal.price)} · cost {formatZar(r.meal.cost)}</div>
                    <ul className="text-[11px] text-ink-2 mt-2 space-y-0.5">{r.reasons.slice(0, 4).map((x) => <li key={x}>✓ {x}</li>)}{r.cautions.map((x) => <li key={x} className="text-amber-800">! {x}</li>)}</ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Excluded meals" kicker="Allergies, pattern, medical">{ex.length === 0 ? <Empty>Nothing excluded.</Empty> : <ul className="text-sm space-y-1">{ex.map((e) => <li key={e.meal.id}><b>{e.meal.name}</b> <span className="text-xs text-ink-2">{e.cautions.join(" ")}</span></li>)}</ul>}</Card>
        <Card title="Ingredient substitutions" kicker="To unlock excluded meals">{subs.length === 0 ? <Empty>No substitutions needed.</Empty> : <ul className="text-sm space-y-1">{subs.map((s, i) => <li key={i}><b>{s.ingredient}</b> → {s.suggest} <span className="text-xs text-ink-3">({s.because})</span></li>)}</ul>}</Card>
      </div>
      <Card title="Portion guidance"><p className="text-sm text-ink-2">Portion multipliers (0.75× / 1× / 1.25×) are applied per plan item. When a day’s energy total falls outside the client’s range, the planner suggests a multiplier change before swapping meals.</p></Card>
    </div>
  );
}

function ProgressTab({ clientId }: { clientId: number }) {
  const rows = listProgress(clientId);
  const labels = rows.map((r) => r.logged_at.slice(5));
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Weight" className="lg:col-span-2">{rows.length ? <LineChart labels={labels} series={[{ name: "Weight (kg)", values: rows.map((r) => r.weight_kg ?? NaN) }]} yMin={Math.min(...rows.map((r) => r.weight_kg ?? 999)) - 3} /> : <Empty>No check-ins yet.</Empty>}</Card>
      <Card title="Log a check-in">
        <form action={addProgressAction} className="grid grid-cols-2 gap-2">
          <input type="hidden" name="client_id" value={clientId} />
          <Field label="Date"><input name="logged_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></Field>
          <Field label="Weight (kg)"><input name="weight_kg" type="number" step="0.1" className="input" /></Field>
          <Field label="Waist (cm)"><input name="waist_cm" type="number" step="0.5" className="input" /></Field>
          <Field label="Adherence %"><input name="adherence_pct" type="number" className="input" /></Field>
          <Field label="Energy (1–5)"><input name="energy" type="number" min={1} max={5} className="input" /></Field>
          <Field label="Satisfaction (1–5)"><input name="satisfaction" type="number" min={1} max={5} className="input" /></Field>
          <Field label="Water (L)"><input name="water_litres" type="number" step="0.5" className="input" /></Field>
          <Field label="Exercise (min)"><input name="exercise_minutes" type="number" className="input" /></Field>
          <Field label="Notes" className="col-span-2"><input name="notes" className="input" /></Field>
          <div><button className="btn-primary btn-sm">Save</button></div>
        </form>
      </Card>
      <Card title="Adherence, energy & satisfaction" className="lg:col-span-3">{rows.length ? <LineChart labels={labels} series={[{ name: "Adherence %", values: rows.map((r) => r.adherence_pct ?? NaN) }, { name: "Energy ×20", values: rows.map((r) => (r.energy ?? NaN) * 20) }, { name: "Satisfaction ×20", values: rows.map((r) => (r.satisfaction ?? NaN) * 20) }]} height={160} /> : <Empty>No data.</Empty>}</Card>
      <Card title="Check-in history" className="lg:col-span-3">{rows.length ? <table className="table"><thead><tr><th>Date</th><th>Weight</th><th>Waist</th><th>Adherence</th><th>Energy</th><th>Satisfaction</th><th>Water</th><th>Exercise</th><th>Notes</th></tr></thead><tbody>{[...rows].reverse().map((r) => <tr key={r.id}><td>{fmtDate(r.logged_at)}</td><td>{r.weight_kg ?? "—"}</td><td>{r.waist_cm ?? "—"}</td><td>{r.adherence_pct ?? "—"}%</td><td>{r.energy ?? "—"}</td><td>{r.satisfaction ?? "—"}</td><td>{r.water_litres ?? "—"} L</td><td>{r.exercise_minutes ?? "—"} min</td><td className="text-xs text-ink-2">{r.notes}</td></tr>)}</tbody></table> : <Empty>No data.</Empty>}</Card>
    </div>
  );
}

