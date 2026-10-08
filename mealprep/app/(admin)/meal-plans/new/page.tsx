import { requirePermission } from "@/lib/auth";
import { listClients, getClientFull } from "@/lib/repo/clients";
import { mondayOf } from "@/lib/repo/orders";
import { PageHeader, Card, Field, Disclaimer } from "@/components/ui";
import { GOAL_LABELS } from "@/lib/types";
import { generatePlanAction } from "@/app/actions";
import { shiftDays, todayIso } from "@/lib/finance";

export default async function NewPlan({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requirePermission("plans:edit");
  const { client } = await searchParams;
  const clients = listClients();
  const selected = client ? getClientFull(Number(client)) : null;
  const nextMonday = mondayOf(shiftDays(todayIso(), 7));
  return (
    <div className="max-w-3xl">
      <PageHeader kicker="Planner" title="Generate a weekly plan">The generator scores every meal against the client’s targets, allergies, preferences, budget and stock, rotates for variety, and audits each day for nutritional gaps.</PageHeader>
      <Disclaimer />
      <Card className="mt-4">
        <form action={generatePlanAction} className="grid sm:grid-cols-2 gap-3">
          <Field label="Client" className="sm:col-span-2"><select name="client_id" defaultValue={client ?? ""} className="input" required><option value="">Select a client</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.status}){c.review_flag ? " — review pending" : ""}</option>)}</select></Field>
          <Field label="Week starting (Monday)"><input name="week_start" type="date" defaultValue={nextMonday} className="input" required /></Field>
          <Field label="Goal"><select name="goal_type" defaultValue={selected?.goals[0]?.goal_type ?? ""} className="input"><option value="">Use client’s primary goal</option>{Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Meals per day"><select name="meals_per_day" defaultValue={selected?.prefs?.meals_per_day ?? 3} className="input">{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
          <Field label="Weekly budget (R)"><input name="budget_zar" type="number" defaultValue={selected?.prefs?.budget_per_week_zar ?? ""} className="input" /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="include_snacks" defaultChecked={!!(selected?.prefs?.include_snacks ?? 1)} /> Include a daily snack</label>
          <Field label="Notes for the client" className="sm:col-span-2"><input name="notes" className="input" /></Field>
          <div><button className="btn-primary">Generate plan</button></div>
        </form>
      </Card>
      {selected && <Card className="mt-4" title="Targets used" kicker={`${selected.client.first_name} ${selected.client.last_name}`}><div className="text-sm text-ink-2">{selected.computed.calories_min ?? "—"}–{selected.computed.calories_max ?? "—"} kcal · protein {selected.computed.protein_g ?? "—"} g · fibre {selected.computed.fibre_g} g · pattern {selected.prefs?.dietary_pattern} · {selected.allergies.length} allergy/intolerance entries{selected.computed.requires_professional_review ? " · PROFESSIONAL REVIEW PENDING (plan will be marked preliminary)" : ""}</div></Card>}
    </div>
  );
}
