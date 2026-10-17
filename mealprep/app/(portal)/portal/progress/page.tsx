import { requireClient } from "@/lib/auth";
import { listProgress, getClientFull } from "@/lib/repo/clients";
import { Card, Field, Empty, fmtDate, Stat } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { addProgressAction } from "@/app/actions";

export default async function Progress() {
  const user = await requireClient();
  const rows = listProgress(user.client_id);
  const f = getClientFull(user.client_id)!;
  const goal = f.goals.find((g) => g.is_primary);
  const first = rows[0], last = rows[rows.length - 1];
  const change = first?.weight_kg && last?.weight_kg ? last.weight_kg - first.weight_kg : null;
  const toGo = goal?.target_value && last?.weight_kg ? last.weight_kg - goal.target_value : null;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">My progress</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Stat label="Check-ins" value={rows.length} /><Stat label="Change since start" value={change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`} /><Stat label="To goal" value={toGo == null ? "—" : `${Math.abs(toGo).toFixed(1)} kg`} sub={goal?.target_value ? `target ${goal.target_value} kg` : "no weight target"} /><Stat label="Avg adherence" value={rows.length ? `${Math.round(rows.reduce((s, r) => s + (r.adherence_pct ?? 0), 0) / rows.length)}%` : "—"} /></div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card title="Weight" className="md:col-span-2">{rows.length ? <LineChart labels={rows.map((r) => r.logged_at.slice(5))} series={[{ name: "Weight (kg)", values: rows.map((r) => r.weight_kg ?? NaN) }]} yMin={Math.min(...rows.map((r) => r.weight_kg ?? 999)) - 3} /> : <Empty>Log your first check-in.</Empty>}</Card>
        <Card title="Weekly check-in"><form action={addProgressAction} className="grid grid-cols-2 gap-2"><Field label="Date"><input name="logged_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" /></Field><Field label="Weight (kg)"><input name="weight_kg" type="number" step="0.1" className="input" /></Field><Field label="Waist (cm)"><input name="waist_cm" type="number" step="0.5" className="input" /></Field><Field label="Meals followed %"><input name="adherence_pct" type="number" className="input" /></Field><Field label="Energy (1–5)"><input name="energy" type="number" min={1} max={5} className="input" /></Field><Field label="Satisfaction (1–5)"><input name="satisfaction" type="number" min={1} max={5} className="input" /></Field><Field label="Water (L/day)"><input name="water_litres" type="number" step="0.5" className="input" /></Field><Field label="Exercise (min)"><input name="exercise_minutes" type="number" className="input" /></Field><Field label="Notes" className="col-span-2"><input name="notes" className="input" /></Field><div><button className="btn-primary btn-sm">Save</button></div></form></Card>
        <Card title="Energy, satisfaction & adherence" className="md:col-span-3">{rows.length ? <LineChart labels={rows.map((r) => r.logged_at.slice(5))} series={[{ name: "Adherence %", values: rows.map((r) => r.adherence_pct ?? NaN) }, { name: "Energy ×20", values: rows.map((r) => (r.energy ?? NaN) * 20) }, { name: "Satisfaction ×20", values: rows.map((r) => (r.satisfaction ?? NaN) * 20) }]} height={160} /> : <Empty>No data yet.</Empty>}</Card>
      </div>
      <p className="text-xs text-ink-3">Progress tracking is for your own motivation and your planner’s adjustments. It is not a medical assessment. {rows.length ? `Last check-in ${fmtDate(last.logged_at)}.` : ""}</p>
    </div>
  );
}
