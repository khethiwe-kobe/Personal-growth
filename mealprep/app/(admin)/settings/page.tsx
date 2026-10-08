import { requirePermission } from "@/lib/auth";
import { getAllSettings, getDb } from "@/lib/db";
import { PageHeader, Card, Field, StatusBadge } from "@/components/ui";
import { ROLES, ROLE_LABELS } from "@/lib/types";
import { PERMISSIONS } from "@/lib/auth";
import { saveSettingsAction, saveUserAction } from "@/app/actions";
import { fmtDate } from "@/components/ui";

export default async function Settings({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requirePermission("settings:edit");
  const { edit } = await searchParams;
  const s = getAllSettings();
  const users = getDb().prepare("SELECT id, email, name, role, phone, is_active, last_login_at FROM users WHERE role != 'client' ORDER BY role, name").all() as { id: number; email: string; name: string; role: string; phone: string; is_active: number; last_login_at: string | null }[];
  const editing = edit ? users.find((u) => u.id === Number(edit)) : undefined;
  const locations = getDb().prepare("SELECT * FROM locations").all() as { id: number; name: string; address: string; capacity_meals_per_day: number }[];
  return (
    <div>
      <PageHeader kicker="Administration" title="Settings">Brand, defaults, staff accounts and role permissions.</PageHeader>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Business" className="lg:col-span-2"><form action={saveSettingsAction} className="grid sm:grid-cols-2 gap-3">
          <Field label="Brand name"><input name="set_brand_name" defaultValue={s.brand_name} className="input" /></Field>
          <Field label="Tagline"><input name="set_tagline" defaultValue={s.tagline} className="input" /></Field>
          <Field label="Currency"><input name="set_currency" defaultValue={s.currency} className="input" /></Field>
          <Field label="Timezone"><input name="set_timezone" defaultValue={s.timezone} className="input" /></Field>
          <Field label="Kitchen capacity (meals/day)"><input name="set_kitchen_capacity_meals_per_day" type="number" defaultValue={s.kitchen_capacity_meals_per_day} className="input" /></Field>
          <Field label="Consent version"><input name="set_consent_version" defaultValue={s.consent_version} className="input" /></Field>
          <Field label="Nutrition disclaimer" className="sm:col-span-2"><textarea name="set_disclaimer" rows={3} defaultValue={s.disclaimer} className="input" /></Field>
          <div><button className="btn-primary btn-sm">Save</button></div>
        </form><p className="text-xs text-ink-2 mt-3">Cost and margin assumptions live under Pricing engine → Assumptions. Packages under Pricing engine → Packages.</p></Card>
        <Card title="Locations" kicker="Multi-kitchen ready"><ul className="text-sm">{locations.map((l) => <li key={l.id}>{l.name} <span className="text-xs text-ink-3">· {l.capacity_meals_per_day} meals/day</span></li>)}</ul><p className="text-xs text-ink-2 mt-2">Clients, orders and production batches carry a location id so a second kitchen can be added without schema changes.</p></Card>
        <Card title="Staff accounts" className="lg:col-span-2"><table className="table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Status</th><th></th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td className="font-medium">{u.name}</td><td className="text-xs">{u.email}</td><td className="text-xs">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</td><td className="text-xs">{fmtDate(u.last_login_at)}</td><td><StatusBadge status={u.is_active ? "active" : "paused"} /></td><td><a href={`/settings?edit=${u.id}`} className="btn-ghost btn-sm">Edit</a></td></tr>)}</tbody></table></Card>
        <Card title={editing ? `Edit ${editing.name}` : "Add staff member"}><form action={saveUserAction} className="grid grid-cols-2 gap-2">{editing && <input type="hidden" name="id" value={editing.id} />}<Field label="Name" className="col-span-2"><input name="name" defaultValue={editing?.name ?? ""} className="input" required /></Field><Field label="Email" className="col-span-2"><input name="email" type="email" defaultValue={editing?.email ?? ""} className="input" required /></Field><Field label="Role"><select name="role" defaultValue={editing?.role ?? "kitchen"} className="input">{ROLES.filter((r) => r !== "client").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field><Field label="Phone"><input name="phone" defaultValue={editing?.phone ?? ""} className="input" /></Field><Field label={editing ? "New password (blank = keep)" : "Password"} className="col-span-2"><input name="password" type="password" className="input" /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={editing ? !!editing.is_active : true} /> Active</label><div className="flex gap-2"><button className="btn-primary btn-sm">Save</button>{editing && <a href="/settings" className="btn-secondary btn-sm">New</a>}</div></form></Card>
        <Card title="Role permissions" className="lg:col-span-3"><div className="overflow-x-auto"><table className="table"><thead><tr><th>Role</th><th>Permissions</th></tr></thead><tbody>{ROLES.map((r) => <tr key={r}><td className="font-medium whitespace-nowrap">{ROLE_LABELS[r]}</td><td className="text-xs text-ink-2">{r === "client" ? "Own profile, plans, orders, deliveries, subscription, progress, payments and feedback via the client portal." : PERMISSIONS[r].join(", ")}</td></tr>)}</tbody></table></div></Card>
      </div>
    </div>
  );
}
