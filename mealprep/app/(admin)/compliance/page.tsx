import { requirePermission, can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, StatusBadge, Stat, fmtDate } from "@/components/ui";
import { saveComplianceAction } from "@/app/actions";

export default async function Compliance() {
  const user = await requirePermission("compliance:view");
  const rows = getDb().prepare("SELECT * FROM compliance_items ORDER BY sort_order").all() as { id: number; area: string; requirement: string; guidance: string; status: string; evidence: string; reviewed_at: string | null }[];
  const done = rows.filter((r) => r.status === "done").length;
  return (
    <div>
      <PageHeader kicker="Food safety & regulation" title="Compliance checklist">This checklist does not confirm legal compliance. Review each item against the applicable South African regulations (R638, R146, the Foodstuffs Act, municipal by-laws, POPIA) and your local Environmental Health Practitioner’s requirements.</PageHeader>
      <div className="grid grid-cols-3 gap-3 mb-5"><Stat label="Items" value={rows.length} /><Stat label="Done" value={done} tone="good" /><Stat label="Outstanding" value={rows.length - done} tone={rows.length - done ? "warn" : "good"} /></div>
      <div className="space-y-3">{rows.map((r) => (
        <Card key={r.id}>
          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            <div><div className="kicker">{r.area}</div><div className="font-medium text-sm mt-0.5">{r.requirement}</div><p className="text-xs text-ink-2 mt-1">{r.guidance}</p>{r.reviewed_at && <div className="text-[11px] text-ink-3 mt-1">Reviewed {fmtDate(r.reviewed_at)}</div>}</div>
            {can(user, "compliance:edit") ? <form action={saveComplianceAction} className="flex flex-col gap-1"><input type="hidden" name="id" value={r.id} /><select name="status" defaultValue={r.status} className="input !py-1 !text-xs">{["todo", "in_progress", "done", "na"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select><input name="evidence" defaultValue={r.evidence} placeholder="Evidence / notes / document reference" className="input !py-1 !text-xs" /><button className="btn-secondary btn-sm">Save</button></form> : <StatusBadge status={r.status} />}
          </div>
        </Card>))}</div>
    </div>
  );
}
