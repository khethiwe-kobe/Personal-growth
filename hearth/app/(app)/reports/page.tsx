"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useTransactions } from "@/lib/useTransactions";
import {
  businessSummary,
  categoryBreakdown,
  contributionsByMember,
  monthsInData,
  sum,
  totalByKind,
  totalHouseholdExpenses,
  whoOwesWho,
} from "@/lib/money";
import { currentMonth, fmtR, monthLabelShort, round2 } from "@/lib/format";
import { BarList, Columns, TrendLine } from "@/components/charts";
import { Card, MonthNav, PageHeader, SectionTitle, Stat } from "@/components/ui";

export default function ReportsPage() {
  const { household, memberIds, categories, nameOf } = useApp();
  const { txs, loading } = useTransactions();
  const [ym, setYm] = useState(currentMonth());

  const report = useMemo(() => {
    const contributions = contributionsByMember(txs, ym);
    const biz = businessSummary(txs, ym);
    const kinds = [
      { label: "Rent", value: totalByKind(txs, ym, "rent") },
      { label: "Groceries", value: totalByKind(txs, ym, "grocery") },
      { label: "Electricity", value: totalByKind(txs, ym, "electricity") },
      { label: "Transport", value: totalByKind(txs, ym, "transport") },
    ];
    const totalExpenses = totalHouseholdExpenses(txs, ym);
    const other = round2(totalExpenses - sum(
      kinds.map((k) => k.value),
    ));
    if (other > 0.01) kinds.push({ label: "Other", value: other });
    const totalIncome = round2(
      sum(Object.values(contributions)) + biz.contributedThisMonth,
    );
    const owes = whoOwesWho(txs);

    const months = monthsInData(txs, ym);
    const totals = months.map((m) => ({ label: monthLabelShort(m), value: totalHouseholdExpenses(txs, m) }));
    const avg = totals.length ? round2(sum(totals.map((t) => t.value)) / totals.length) : 0;
    const groceriesTrend = months.map((m) => ({ label: monthLabelShort(m), value: totalByKind(txs, m, "grocery") }));
    const elecTrend = months.map((m) => ({ label: monthLabelShort(m), value: totalByKind(txs, m, "electricity") }));
    const bizTrend = months.map((m) => ({ label: monthLabelShort(m), value: totalByKind(txs, m, "contribution") }));

    const idx = months.indexOf(ym);
    const prevYm = idx > 0 ? months[idx - 1] : null;
    const deltas = prevYm
      ? [
          ["Groceries", totalByKind(txs, ym, "grocery"), totalByKind(txs, prevYm, "grocery")],
          ["Electricity", totalByKind(txs, ym, "electricity"), totalByKind(txs, prevYm, "electricity")],
          ["Household total", totalExpenses, totalHouseholdExpenses(txs, prevYm)],
        ].map(([label, now, prev]) => ({
          label: label as string,
          now: now as number,
          prev: prev as number,
        }))
      : [];

    return {
      contributions,
      biz,
      kinds,
      totalExpenses,
      totalIncome,
      owes,
      totals: totals.slice(-8),
      avg,
      groceriesTrend: groceriesTrend.slice(-8),
      elecTrend: elecTrend.slice(-8),
      bizTrend: bizTrend.slice(-8),
      deltas,
      breakdown: categoryBreakdown(txs, ym, categories),
    };
  }, [txs, ym, categories]);

  if (!household) return null;

  return (
    <div>
      <PageHeader
        title="Monthly review"
        description="A calm end-of-month picture, and how things are trending."
        actions={<MonthNav value={ym} onChange={setYm} />}
      />

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total funding" value={fmtR(report.totalIncome)} sub="personal + business" />
            <Stat label="Total expenses" value={fmtR(report.totalExpenses)} />
            <Stat
              label="Balance"
              value={fmtR(round2(report.totalIncome - report.totalExpenses))}
              tone={report.totalIncome - report.totalExpenses >= 0 ? "good" : "bad"}
            />
            <Stat
              label="Owed between you"
              value={report.owes ? fmtR(report.owes.amount) : "R0.00"}
              sub={report.owes ? `${nameOf(report.owes.owedBy)} owes ${nameOf(report.owes.owedTo)}` : "all square"}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle>How the household was funded</SectionTitle>
              <BarList
                rows={[
                  ...memberIds.map((id) => ({
                    label: nameOf(id),
                    value: report.contributions[id] ?? 0,
                  })),
                  { label: "Shared business", value: report.biz.contributedThisMonth },
                ]}
              />
            </Card>
            <Card>
              <SectionTitle>Where it went</SectionTitle>
              <BarList rows={report.kinds.filter((k) => k.value > 0)} />
            </Card>
          </div>

          {report.deltas.length > 0 && (
            <Card>
              <SectionTitle>Compared with last month</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {report.deltas.map((d) => {
                  const diff = round2(d.now - d.prev);
                  return (
                    <div key={d.label} className="rounded-lg bg-surface-2 p-3">
                      <div className="text-xs text-muted">{d.label}</div>
                      <div className="mt-1 text-sm font-medium tabular-nums">
                        {fmtR(d.now)}{" "}
                        <span className={diff > 0 ? "text-warn" : diff < 0 ? "text-good" : "text-muted"}>
                          ({diff > 0 ? "+" : ""}{fmtR(diff)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle>Household spending by month</SectionTitle>
              <Columns points={report.totals} />
              <p className="mt-3 text-sm text-muted">
                Average monthly spending: <span className="font-medium text-ink tabular-nums">{fmtR(report.avg)}</span>
              </p>
            </Card>
            <Card>
              <SectionTitle>Business contribution over time</SectionTitle>
              <TrendLine points={report.bizTrend} />
            </Card>
            <Card>
              <SectionTitle>Groceries over time</SectionTitle>
              <TrendLine points={report.groceriesTrend} />
            </Card>
            <Card>
              <SectionTitle>Electricity over time</SectionTitle>
              <TrendLine points={report.elecTrend} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
