"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import type { ImportedTx, Statement } from "@/lib/types";
import { normImportedTx } from "@/lib/types";
import { logActivity, uploadFile } from "@/lib/data";
import { suggestCategory } from "@/lib/constants";
import { fmtDate, fmtR, round2 } from "@/lib/format";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  PageHeader,
  SectionTitle,
  Select,
  Tag,
} from "@/components/ui";

// ---------------------------------------------------------------------------
// Minimal CSV parsing (handles quoted fields). Expected columns: a date, a
// description/narrative, and either a signed amount or debit/credit columns.
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

function parseDateCell(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parseAmountCell(v: string): number | null {
  const s = v.replace(/[R\s]/gi, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  if (!s || !/[\d]/.test(s)) return null;
  const n = Number(s.replace(/[()]/g, "")) * (/^\(.*\)$/.test(v.trim()) ? -1 : 1);
  return Number.isFinite(n) ? round2(n) : null;
}

type ParsedRow = { occurred_on: string; description: string; amount: number; type: "expense" | "income" };

function extractRows(rows: string[][]): { parsed: ParsedRow[]; skipped: number } {
  if (!rows.length) return { parsed: [], skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const find = (...keys: string[]) =>
    header.findIndex((h) => keys.some((k) => h.includes(k)));
  const di = find("date");
  const desci = find("description", "narrative", "details", "reference", "memo");
  const ai = find("amount", "value");
  const debi = find("debit");
  const credi = find("credit");
  const hasHeader = di >= 0;
  const body = hasHeader ? rows.slice(1) : rows;
  const parsed: ParsedRow[] = [];
  let skipped = 0;
  for (const r of body) {
    const date = parseDateCell(r[hasHeader && di >= 0 ? di : 0] ?? "");
    const desc = (r[hasHeader && desci >= 0 ? desci : 1] ?? "").trim();
    let amount: number | null = null;
    if (hasHeader && ai >= 0) amount = parseAmountCell(r[ai] ?? "");
    else if (hasHeader && (debi >= 0 || credi >= 0)) {
      const deb = debi >= 0 ? parseAmountCell(r[debi] ?? "") : null;
      const cred = credi >= 0 ? parseAmountCell(r[credi] ?? "") : null;
      amount = deb ? -Math.abs(deb) : cred ? Math.abs(cred) : null;
    } else amount = parseAmountCell(r[2] ?? "");
    if (!date || !desc || amount === null || amount === 0) { skipped++; continue; }
    parsed.push({
      occurred_on: date,
      description: desc,
      amount: Math.abs(amount),
      type: amount < 0 ? "expense" : "income",
    });
  }
  return { parsed, skipped };
}

// ---------------------------------------------------------------------------

export default function JointPage() {
  const { sb, household, user, categories } = useApp();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [imports, setImports] = useState<ImportedTx[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryPick, setCategoryPick] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!household) return;
    const [{ data: st }, { data: im }] = await Promise.all([
      sb.from("statements").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
      sb.from("imported_transactions").select("*").eq("household_id", household.id).order("occurred_on", { ascending: false }),
    ]);
    setStatements((st ?? []) as Statement[]);
    setImports((im ?? []).map(normImportedTx));
  }, [sb, household]);

  useEffect(() => {
    load();
  }, [load]);

  async function onUpload(file: File) {
    if (!household || !user) return;
    setError("");
    setNotice("");
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return setError("For now, upload a CSV export of the statement. Excel and PDF can be converted to CSV first.");
    }
    setBusy(true);
    const text = await file.text();
    const { parsed, skipped } = extractRows(parseCsv(text));
    if (!parsed.length) {
      setBusy(false);
      return setError("Could not find transactions in that file. It needs date, description and amount columns.");
    }

    const up = await uploadFile(sb, household.id, "statements", file);
    const { data: st, error: stErr } = await sb
      .from("statements")
      .insert({
        household_id: household.id,
        file_name: file.name,
        file_path: up.path ?? null,
        status: "processed",
        uploaded_by: user.id,
      })
      .select("*")
      .single();
    if (stErr) {
      setBusy(false);
      return setError(stErr.message);
    }

    const { error: imErr } = await sb.from("imported_transactions").insert(
      parsed.map((p) => ({
        household_id: household.id,
        statement_id: st.id,
        occurred_on: p.occurred_on,
        description: p.description,
        amount: p.amount,
        type: p.type,
        suggested_category: suggestCategory(p.description),
      })),
    );
    setBusy(false);
    if (imErr) return setError(imErr.message);
    await logActivity(sb, household.id, user.id, "import", "statement", st.id,
      `uploaded a bank statement "${file.name}" — ${parsed.length} transactions to review`);
    setNotice(`Imported ${parsed.length} transactions to review${skipped ? ` (${skipped} rows skipped)` : ""}.`);
    load();
  }

  async function approve(row: ImportedTx) {
    if (!household || !user) return;
    const catName = categoryPick[row.id] ?? row.suggested_category ?? "Other";
    const category = categories.find((c) => c.name === catName);
    const { data: tx, error: txErr } = await sb
      .from("transactions")
      .insert({
        household_id: household.id,
        occurred_on: row.occurred_on,
        description: row.description,
        category_id: category?.id ?? null,
        amount: row.amount,
        type: row.type,
        scope: "shared",
        kind: "general",
        paid_by: null,
        split_type: "none",
        source: "import",
        review_status: "approved",
        created_by: user.id,
        meta: {},
      })
      .select("id")
      .single();
    if (txErr) return setError(txErr.message);
    await sb
      .from("imported_transactions")
      .update({ status: "approved", transaction_id: tx.id })
      .eq("id", row.id);
    setImports((l) => (l ?? []).map((i) => (i.id === row.id ? { ...i, status: "approved" as const } : i)));
    await logActivity(sb, household.id, user.id, "approve", "imported_transaction", row.id,
      `approved imported transaction "${row.description}" (${fmtR(row.amount)}) as ${catName}`);
  }

  async function dismiss(row: ImportedTx) {
    if (!household || !user) return;
    await sb.from("imported_transactions").update({ status: "dismissed" }).eq("id", row.id);
    setImports((l) => (l ?? []).map((i) => (i.id === row.id ? { ...i, status: "dismissed" as const } : i)));
  }

  const pending = useMemo(() => (imports ?? []).filter((i) => i.status === "pending"), [imports]);
  const reviewed = useMemo(() => (imports ?? []).filter((i) => i.status !== "pending"), [imports]);

  return (
    <div>
      <PageHeader
        title="Joint account"
        description="Upload a bank statement, review each transaction, and allocate it — nothing is categorised without your approval."
      />

      <Card className="mb-6">
        <SectionTitle>Upload a statement</SectionTitle>
        <p className="mb-3 text-sm text-muted">
          CSV exports work best (most banks offer them). The file needs date, description
          and amount columns; imported transactions land below as{" "}
          <Tag tone="warn">Needs review</Tag> and only become real transactions once approved.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink"
        />
        {busy ? <p className="mt-2 text-sm text-muted">Processing…</p> : null}
        <div className="mt-3 space-y-1">
          <ErrorNote>{error || null}</ErrorNote>
          {notice ? <p className="text-sm text-good">{notice}</p> : null}
        </div>
      </Card>

      <SectionTitle>Needs review ({pending.length})</SectionTitle>
      {imports === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !pending.length ? (
        <Empty>Nothing waiting for review.</Empty>
      ) : (
        <div className="mb-8 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-faint">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(row.occurred_on)}</td>
                  <td className="px-4 py-3">
                    {row.description}
                    {row.type === "income" && <Tag tone="good">Income</Tag>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {row.type === "income" ? "+" : ""}{fmtR(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={categoryPick[row.id] ?? row.suggested_category ?? "Other"}
                      onChange={(e) => setCategoryPick((s) => ({ ...s, [row.id]: e.target.value }))}
                      className="w-auto"
                    >
                      {categories
                        .filter((c) => c.kind === (row.type === "income" ? "income" : "expense"))
                        .map((c) => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </Select>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" onClick={() => approve(row)}>Approve</Button>
                      <Button size="sm" variant="ghost" onClick={() => dismiss(row)}>Dismiss</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {statements.length > 0 && (
        <div className="mt-8">
          <SectionTitle>Statements</SectionTitle>
          <Card className="divide-y divide-border p-0">
            {statements.map((st) => (
              <div key={st.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{st.file_name}</span>
                <span className="text-xs text-muted">{fmtDate(st.created_at.slice(0, 10))}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="mt-8">
          <SectionTitle>Previously reviewed</SectionTitle>
          <Card className="divide-y divide-border p-0">
            {reviewed.slice(0, 20).map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate text-muted">
                  {fmtDate(row.occurred_on)} — {row.description}
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap tabular-nums">
                  {fmtR(row.amount)}
                  <Tag tone={row.status === "approved" ? "good" : "neutral"}>{row.status}</Tag>
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
