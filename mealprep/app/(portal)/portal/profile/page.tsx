import { requireClient } from "@/lib/auth";
import { getClientFull, clientPrefsParsed } from "@/lib/repo/clients";
import { Card, Field } from "@/components/ui";
import { updatePortalProfileAction } from "@/app/actions";
import { GOAL_LABELS, ALLERGEN_LABELS, type GoalType } from "@/lib/types";
import Link from "next/link";

export default async function Profile() {
  const user = await requireClient();
  const f = getClientFull(user.client_id)!;
  const p = clientPrefsParsed(f.prefs);
  const goal = f.goals.find((g) => g.is_primary);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">My profile</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="My goals"><div className="text-sm">{goal ? <><b>{GOAL_LABELS[goal.goal_type as GoalType] ?? goal.goal_type}</b>{goal.description && <> — {goal.description}</>}{goal.target_value ? <div className="text-ink-2">Target {goal.target_value} kg{goal.target_date ? ` by ${goal.target_date}` : ""}</div> : null}</> : "No goal set."}</div><div className="kicker mt-4 mb-1">Allergies & intolerances</div><div className="flex flex-wrap gap-1">{f.allergies.length ? f.allergies.map((a) => <span key={a.id} className="badge bg-rose-50 text-rose-900">{a.kind}: {ALLERGEN_LABELS[a.allergen] ?? a.allergen}</span>) : <span className="text-sm text-ink-3">None recorded</span>}</div><p className="text-xs text-ink-2 mt-3">To change goals, allergies or health information, contact your planner so the change is reviewed.</p></Card>
        <Card title="Contact, delivery & tastes">
          <form action={updatePortalProfileAction} className="grid grid-cols-2 gap-2">
            <Field label="Phone"><input name="phone" defaultValue={f.client.phone} className="input" /></Field>
            <Field label="Emergency contact"><input name="emergency_contact" defaultValue={f.client.emergency_contact} className="input" /></Field>
            <Field label="Delivery address" className="col-span-2"><input name="delivery_address" defaultValue={f.client.delivery_address} className="input" /></Field>
            <Field label="Delivery notes" className="col-span-2"><input name="delivery_notes" defaultValue={f.client.delivery_notes} className="input" /></Field>
            <Field label="Foods I love" className="col-span-2"><input name="liked_foods" defaultValue={p.liked.join(", ")} className="input" /></Field>
            <Field label="Foods I dislike" className="col-span-2"><input name="disliked_foods" defaultValue={p.disliked.join(", ")} className="input" /></Field>
            <Field label="Cuisines"><input name="cuisines" defaultValue={p.cuisines.join(", ")} className="input" /></Field>
            <Field label="Spice"><select name="spice_level" defaultValue={f.prefs?.spice_level ?? "medium"} className="input">{["mild", "medium", "hot"].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <div><button className="btn-primary btn-sm">Save</button></div>
          </form>
        </Card>
        <Card title="Your data" className="md:col-span-2"><p className="text-sm text-ink-2">We hold your profile, health information (special personal information), plans, orders, payments and feedback to deliver this service, under consent version {f.client.id ? "on file" : ""}. You may request a full export or deletion at any time by contacting us; staff can action both from your profile. <Link href="/notifications" className="text-accent">Notifications</Link></p></Card>
      </div>
    </div>
  );
}
