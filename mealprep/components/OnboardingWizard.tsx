"use client";
import { useState, useTransition } from "react";
import { submitOnboarding, afterOnboarding } from "@/app/onboard/actions";
import type { OnboardingData } from "@/lib/repo/clients";
import { GOAL_LABELS, DIETARY_TAGS, ALLERGENS, ALLERGEN_LABELS } from "@/lib/types";
import { ACTIVITY_LABELS } from "@/lib/nutrition";
import { prettyTag } from "@/lib/recommend";

const STEPS = ["Personal", "Lifestyle", "Nutrition preferences", "Health & dietary", "Goals", "Meal preferences", "Budget", "Delivery", "Consent", "Review"];

type Draft = OnboardingData;
const F = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => <label className="block"><span className="label">{label}</span>{children}{hint && <span className="block text-[11px] text-ink-3 mt-1">{hint}</span>}</label>;
const initial: Draft = {
  first_name: "", last_name: "", email: "", phone: "", date_of_birth: "", gender: "unspecified", address: "", delivery_address: "", delivery_notes: "", emergency_contact: "", source: "",
  height_cm: null, weight_kg: null, target_weight_kg: null, activity_level: "moderate", fitness_level: "beginner", blood_type: "", training_schedule: "", lifestyle: "", sleep_hours: null, water_litres: null, stress_level: "",
  is_pregnant: false, is_breastfeeding: false, medical_conditions: "", medications: "", eating_disorder_history: false, medically_restricted_diet: "", other_notes: "",
  dietary_pattern: "omnivore", dietary_tags: [], cuisines: [], liked_foods: [], disliked_foods: [], meals_per_day: 3, include_snacks: true, meal_times: { breakfast: "07:00", lunch: "12:30", dinner: "19:00" }, people_served: 1,
  cooking_preference: "ready_to_heat", spice_level: "medium", budget_per_meal_zar: null, budget_per_week_zar: null, preferred_delivery_days: [],
  allergies: [], goal_type: "balanced", goal_description: "", goal_target_value: null, goal_target_date: null,
  consents: { data_processing: false, health_data: false, marketing: false, terms: false }, consent_version: "", password: "",
};

export default function OnboardingWizard({ isStaff, consentVersion, brand }: { isStaff: boolean; consentVersion: string; brand: string }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({ ...initial, consent_version: consentVersion });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? null : Number(v));
  const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const bmi = d.height_cm && d.weight_kg ? (d.weight_kg / ((d.height_cm / 100) ** 2)).toFixed(1) : null;
  const flags: string[] = [];
  if (d.is_pregnant) flags.push("pregnancy"); if (d.is_breastfeeding) flags.push("breastfeeding"); if (d.medical_conditions.trim()) flags.push("medical condition"); if (d.eating_disorder_history) flags.push("eating-disorder history"); if (d.medically_restricted_diet.trim()) flags.push("medically restricted diet");
  if (d.allergies.some((a) => a.kind === "allergy" && a.severity === "severe")) flags.push("severe allergy");
  if (bmi && (Number(bmi) < 18.5 || Number(bmi) >= 35)) flags.push("BMI outside the standard range");
  if (d.date_of_birth) { const age = (new Date().getTime() - new Date(d.date_of_birth).getTime()) / (365.25 * 86400000); if (age < 18) flags.push("under 18"); }

  const canNext = () => {
    if (step === 0) return d.first_name && d.last_name && d.email;
    if (step === 8) return d.consents.data_processing && d.consents.health_data && d.consents.terms && (isStaff || (d.password ?? "").length >= 8);
    return true;
  };
  const submit = () => start(async () => {
    setError("");
    const r = await submitOnboarding(d);
    if (!r.ok) { setError(r.error); return; }
    setDone(r.client_id);
  });

  if (done) return (
    <div className="card p-6 space-y-3">
      <h2 className="text-2xl">Profile created</h2>
      <p className="text-sm text-ink-2">Your nutrition profile has been generated{flags.length ? ", and because you reported " + flags.join(", ") + " a professional review has been flagged before personalised recommendations are finalised." : " and preliminary meal recommendations are ready."}</p>
      <form action={afterOnboarding.bind(null, done, isStaff)}><button className="btn-primary">{isStaff ? "Open nutrition analysis" : "Go to my portal"}</button></form>
    </div>
  );

  return (
    <div className="card p-6">
      <ol className="flex flex-wrap gap-1 mb-6">{STEPS.map((s, i) => <li key={s} className={`badge ${i === step ? "bg-ink text-white" : i < step ? "bg-emerald-100 text-emerald-900" : "bg-bone-2 text-ink-3"}`}>{i + 1}. {s}</li>)}</ol>
      <h2 className="text-xl mb-4">Step {step + 1} — {STEPS[step]}</h2>

      {step === 0 && <div className="grid sm:grid-cols-2 gap-3">
        <F label="First name"><input value={d.first_name} onChange={(e) => set("first_name", e.target.value)} className="input" /></F>
        <F label="Last name"><input value={d.last_name} onChange={(e) => set("last_name", e.target.value)} className="input" /></F>
        <F label="Email"><input type="email" value={d.email} onChange={(e) => set("email", e.target.value)} className="input" /></F>
        <F label="Phone (WhatsApp)"><input value={d.phone} onChange={(e) => set("phone", e.target.value)} className="input" /></F>
        <F label="Date of birth"><input type="date" value={d.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} className="input" /></F>
        <F label="Gender"><select value={d.gender} onChange={(e) => set("gender", e.target.value)} className="input">{["female", "male", "other", "unspecified"].map((g) => <option key={g} value={g}>{g === "unspecified" ? "prefer not to say" : g}</option>)}</select></F>
        <F label="How did you hear about us?"><select value={d.source} onChange={(e) => set("source", e.target.value)} className="input"><option value="">—</option>{["instagram", "tiktok", "facebook", "google", "whatsapp", "referral", "gym", "other"].map((s) => <option key={s}>{s}</option>)}</select></F>
        <F label="Emergency contact (optional)"><input value={d.emergency_contact} onChange={(e) => set("emergency_contact", e.target.value)} className="input" /></F>
      </div>}

      {step === 1 && <div className="grid sm:grid-cols-2 gap-3">
        <F label="Activity level"><select value={d.activity_level} onChange={(e) => set("activity_level", e.target.value)} className="input">{Object.entries(ACTIVITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
        <F label="Fitness level"><select value={d.fitness_level} onChange={(e) => set("fitness_level", e.target.value)} className="input">{["beginner", "intermediate", "advanced", "athlete"].map((x) => <option key={x}>{x}</option>)}</select></F>
        <F label="Training schedule"><input value={d.training_schedule} onChange={(e) => set("training_schedule", e.target.value)} placeholder="e.g. gym Mon/Wed/Fri 06:00" className="input" /></F>
        <F label="Lifestyle / work"><input value={d.lifestyle} onChange={(e) => set("lifestyle", e.target.value)} placeholder="office, shifts, student…" className="input" /></F>
        <F label="Sleep (hours/night)"><input type="number" step="0.5" value={d.sleep_hours ?? ""} onChange={(e) => set("sleep_hours", num(e.target.value))} className="input" /></F>
        <F label="Water (litres/day)"><input type="number" step="0.5" value={d.water_litres ?? ""} onChange={(e) => set("water_litres", num(e.target.value))} className="input" /></F>
        <F label="Stress level"><select value={d.stress_level} onChange={(e) => set("stress_level", e.target.value)} className="input"><option value="">—</option>{["low", "medium", "high"].map((x) => <option key={x}>{x}</option>)}</select></F>
      </div>}

      {step === 2 && <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Dietary pattern"><select value={d.dietary_pattern} onChange={(e) => set("dietary_pattern", e.target.value)} className="input">{["omnivore", "pescatarian", "vegetarian", "vegan", "halal", "kosher", "other"].map((x) => <option key={x}>{x}</option>)}</select></F>
          <F label="Cuisines you enjoy (comma separated)"><input value={d.cuisines.join(", ")} onChange={(e) => set("cuisines", list(e.target.value))} placeholder="Mediterranean, Asian, Mexican" className="input" /></F>
          <F label="Foods you love"><input value={d.liked_foods.join(", ")} onChange={(e) => set("liked_foods", list(e.target.value))} placeholder="chicken, salmon, sweet potato" className="input" /></F>
          <F label="Foods you dislike"><input value={d.disliked_foods.join(", ")} onChange={(e) => set("disliked_foods", list(e.target.value))} placeholder="mushrooms, olives" className="input" /></F>
        </div>
        <div><span className="label">Preferences</span><div className="flex flex-wrap gap-2">{DIETARY_TAGS.map((t) => <button type="button" key={t} onClick={() => set("dietary_tags", toggle(d.dietary_tags, t))} className={`badge cursor-pointer ${d.dietary_tags.includes(t) ? "bg-ink text-white" : "bg-bone-2 text-ink-2"}`}>{prettyTag(t)}</button>)}</div></div>
      </div>}

      {step === 3 && <div className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2">This information helps us plan safely. It is stored as special personal information. If you report a medical condition, pregnancy, an eating-disorder history or a medically restricted diet, we will recommend a professional review before finalising personalised meals.</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <F label="Height (cm)"><input type="number" value={d.height_cm ?? ""} onChange={(e) => set("height_cm", num(e.target.value))} className="input" /></F>
          <F label="Weight (kg)"><input type="number" step="0.1" value={d.weight_kg ?? ""} onChange={(e) => set("weight_kg", num(e.target.value))} className="input" /></F>
          <F label="BMI (calculated)"><input value={bmi ?? "—"} readOnly className="input bg-bone-2" /></F>
          <F label="Blood type (optional)" hint="Recorded for information only — not used to choose your diet."><input value={d.blood_type} onChange={(e) => set("blood_type", e.target.value)} className="input" /></F>
          <F label="Medical conditions"><input value={d.medical_conditions} onChange={(e) => set("medical_conditions", e.target.value)} placeholder="e.g. type 2 diabetes, hypertension" className="input" /></F>
          <F label="Medications"><input value={d.medications} onChange={(e) => set("medications", e.target.value)} className="input" /></F>
          <F label="Medically restricted diet"><input value={d.medically_restricted_diet} onChange={(e) => set("medically_restricted_diet", e.target.value)} placeholder="e.g. renal, low-FODMAP prescribed" className="input" /></F>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.is_pregnant} onChange={(e) => set("is_pregnant", e.target.checked)} /> Pregnant</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.is_breastfeeding} onChange={(e) => set("is_breastfeeding", e.target.checked)} /> Breastfeeding</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={d.eating_disorder_history} onChange={(e) => set("eating_disorder_history", e.target.checked)} /> History of disordered eating</label>
        </div>
        <div>
          <span className="label">Allergies, intolerances and foods to avoid</span>
          {d.allergies.map((a, i) => <div key={i} className="flex gap-1 mb-1"><select value={a.kind} onChange={(e) => set("allergies", d.allergies.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))} className="input !w-32">{["allergy", "intolerance", "avoid", "medical"].map((k) => <option key={k}>{k}</option>)}</select><input list="al" value={a.allergen} onChange={(e) => set("allergies", d.allergies.map((x, j) => (j === i ? { ...x, allergen: e.target.value } : x)))} placeholder="e.g. peanuts" className="input" /><select value={a.severity} onChange={(e) => set("allergies", d.allergies.map((x, j) => (j === i ? { ...x, severity: e.target.value } : x)))} className="input !w-28">{["mild", "moderate", "severe"].map((k) => <option key={k}>{k}</option>)}</select><button type="button" onClick={() => set("allergies", d.allergies.filter((_, j) => j !== i))} className="btn-ghost btn-sm">✕</button></div>)}
          <datalist id="al">{ALLERGENS.map((a) => <option key={a} value={a}>{ALLERGEN_LABELS[a]}</option>)}</datalist>
          <button type="button" onClick={() => set("allergies", [...d.allergies, { kind: "allergy", allergen: "", severity: "moderate" }])} className="btn-secondary btn-sm">+ Add</button>
        </div>
        <F label="Anything else we should know?"><textarea rows={2} value={d.other_notes} onChange={(e) => set("other_notes", e.target.value)} className="input" /></F>
      </div>}

      {step === 4 && <div className="grid sm:grid-cols-2 gap-3">
        <F label="Primary goal"><select value={d.goal_type} onChange={(e) => set("goal_type", e.target.value)} className="input">{Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
        <F label="Target weight (kg, optional)"><input type="number" step="0.1" value={d.goal_target_value ?? ""} onChange={(e) => { set("goal_target_value", num(e.target.value)); set("target_weight_kg", num(e.target.value)); }} className="input" /></F>
        <F label="Target date (optional)"><input type="date" value={d.goal_target_date ?? ""} onChange={(e) => set("goal_target_date", e.target.value || null)} className="input" /></F>
        <F label="In your words"><input value={d.goal_description} onChange={(e) => set("goal_description", e.target.value)} placeholder="e.g. feel energetic through the afternoon" className="input" /></F>
        <p className="sm:col-span-2 text-xs text-ink-2">Goals shape energy and protein targets using recognised equations with conservative adjustments. They are not medical treatments and we never recommend aggressive restriction.</p>
      </div>}

      {step === 5 && <div className="grid sm:grid-cols-2 gap-3">
        <F label="Meals per day from us"><select value={d.meals_per_day} onChange={(e) => set("meals_per_day", Number(e.target.value))} className="input">{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></F>
        <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={d.include_snacks} onChange={(e) => set("include_snacks", e.target.checked)} /> Include snacks</label>
        {(["breakfast", "lunch", "dinner"] as const).map((k) => <F key={k} label={`Preferred ${k} time`}><input type="time" value={d.meal_times[k] ?? ""} onChange={(e) => set("meal_times", { ...d.meal_times, [k]: e.target.value })} className="input" /></F>)}
        <F label="People being served"><input type="number" min={1} value={d.people_served} onChange={(e) => set("people_served", Number(e.target.value) || 1)} className="input" /></F>
        <F label="Cooking preference"><select value={d.cooking_preference} onChange={(e) => set("cooking_preference", e.target.value)} className="input"><option value="ready_to_heat">Ready to heat</option><option value="some_assembly">Some assembly</option><option value="cook_at_home">Prepped to cook at home</option></select></F>
        <F label="Spice level"><select value={d.spice_level} onChange={(e) => set("spice_level", e.target.value)} className="input">{["mild", "medium", "hot"].map((x) => <option key={x}>{x}</option>)}</select></F>
      </div>}

      {step === 6 && <div className="grid sm:grid-cols-2 gap-3">
        <F label="Budget per meal (R)"><input type="number" value={d.budget_per_meal_zar ?? ""} onChange={(e) => set("budget_per_meal_zar", num(e.target.value))} className="input" /></F>
        <F label="Budget per week (R)"><input type="number" value={d.budget_per_week_zar ?? ""} onChange={(e) => set("budget_per_week_zar", num(e.target.value))} className="input" /></F>
        <p className="sm:col-span-2 text-xs text-ink-2">Recommendations respect your budget; meals above it are shown with a note rather than hidden.</p>
      </div>}

      {step === 7 && <div className="grid sm:grid-cols-2 gap-3">
        <F label="Home address"><input value={d.address} onChange={(e) => set("address", e.target.value)} className="input" /></F>
        <F label="Delivery address (if different)"><input value={d.delivery_address} onChange={(e) => set("delivery_address", e.target.value)} className="input" /></F>
        <F label="Delivery notes"><input value={d.delivery_notes} onChange={(e) => set("delivery_notes", e.target.value)} placeholder="gate code, security, leave with…" className="input" /></F>
        <div><span className="label">Preferred delivery days</span><div className="flex gap-2">{["mon", "tue", "wed", "thu", "fri", "sat"].map((x) => <button type="button" key={x} onClick={() => set("preferred_delivery_days", toggle(d.preferred_delivery_days, x))} className={`badge cursor-pointer ${d.preferred_delivery_days.includes(x) ? "bg-ink text-white" : "bg-bone-2 text-ink-2"}`}>{x}</button>)}</div></div>
      </div>}

      {step === 8 && <div className="space-y-3 text-sm">
        <label className="flex gap-2"><input type="checkbox" checked={d.consents.data_processing} onChange={(e) => set("consents", { ...d.consents, data_processing: e.target.checked })} /><span><b>Personal information.</b> I consent to {brand} processing my personal information to provide meal-planning, preparation and delivery services (POPIA).</span></label>
        <label className="flex gap-2"><input type="checkbox" checked={d.consents.health_data} onChange={(e) => set("consents", { ...d.consents, health_data: e.target.checked })} /><span><b>Health information.</b> I consent to the processing of my health and dietary information (special personal information) solely for nutrition analysis and meal recommendations. I understand this is not medical advice.</span></label>
        <label className="flex gap-2"><input type="checkbox" checked={d.consents.terms} onChange={(e) => set("consents", { ...d.consents, terms: e.target.checked })} /><span><b>Terms.</b> I accept the terms of service and understand I can request a copy or deletion of my data at any time.</span></label>
        <label className="flex gap-2"><input type="checkbox" checked={d.consents.marketing} onChange={(e) => set("consents", { ...d.consents, marketing: e.target.checked })} /><span><b>Marketing (optional).</b> Send me offers and new-menu updates on WhatsApp / email.</span></label>
        {!isStaff && <F label="Create a portal password (min 8 characters)"><input type="password" value={d.password ?? ""} onChange={(e) => set("password", e.target.value)} className="input" /></F>}
        <div className="text-[11px] text-ink-3">Consent version {consentVersion}.</div>
      </div>}

      {step === 9 && <div className="space-y-3 text-sm">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-line p-3"><div className="kicker">Person</div>{d.first_name} {d.last_name} · {d.email} · {d.phone}<br />{d.gender}, born {d.date_of_birth || "—"}</div>
          <div className="rounded-xl border border-line p-3"><div className="kicker">Body & lifestyle</div>{d.height_cm ?? "—"} cm · {d.weight_kg ?? "—"} kg · BMI {bmi ?? "—"} · {ACTIVITY_LABELS[d.activity_level as keyof typeof ACTIVITY_LABELS]?.split(" (")[0]}</div>
          <div className="rounded-xl border border-line p-3"><div className="kicker">Nutrition</div>{d.dietary_pattern} · {d.dietary_tags.map(prettyTag).join(", ") || "no tags"} · allergies: {d.allergies.filter((a) => a.allergen).map((a) => `${a.allergen} (${a.kind})`).join(", ") || "none"}</div>
          <div className="rounded-xl border border-line p-3"><div className="kicker">Plan</div>{GOAL_LABELS[d.goal_type as keyof typeof GOAL_LABELS]} · {d.meals_per_day} meals/day{d.include_snacks ? " + snacks" : ""} · {d.people_served} person(s) · budget R{d.budget_per_meal_zar ?? "—"}/meal</div>
        </div>
        {flags.length > 0 && <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs px-3 py-2"><b>Professional review recommended before personalised meal recommendations are provided.</b> Reason: {flags.join(", ")}. Your profile will still be created and general guidance shown.</div>}
        {error && <div className="text-critical">{error}</div>}
      </div>}

      <div className="flex justify-between mt-6">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-secondary">Back</button>
        {step < STEPS.length - 1 ? <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="btn-primary">Continue</button> : <button type="button" onClick={submit} disabled={pending} className="btn-primary">{pending ? "Creating profile…" : "Submit & generate profile"}</button>}
      </div>
    </div>
  );
}
