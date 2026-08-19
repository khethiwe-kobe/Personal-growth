import type { Tx, Category, Household } from "./types";
import { fmtR, monthKey, round2 } from "./format";

/*
 * Every number in the app is derived from the transactions list by the
 * functions in this file, so any figure on screen can be traced back to
 * specific rows. Conventions:
 *
 * - Household expenses  = type 'expense', scope 'shared', kind != 'settlement'
 * - Personal expenses   = scope 'personal' (never counted in household totals)
 * - Business figures    = kind 'business_income' / 'business_expense'
 * - Business -> household transfers = kind 'contribution' (type 'income')
 * - Settlements         = kind 'settlement': money moving between the two of
 *   you. They affect the who-owes-who balance, never expense totals.
 *
 * Splits: every shared expense stores one row per member with that member's
 * share of the cost. Who-owes-who is then simply
 *   net(person) = everything they paid  -  everything that was their share
 * summed across all shared expenses and settlements. Positive net = owed money.
 */

export function inMonth(t: Tx, ym: string): boolean {
  return monthKey(t.occurred_on) === ym;
}

export function isSettlement(t: Tx): boolean {
  return t.kind === "settlement";
}

export function isHouseholdExpense(t: Tx): boolean {
  return t.type === "expense" && t.scope === "shared" && !isSettlement(t);
}

export function isPersonalExpense(t: Tx): boolean {
  return t.type === "expense" && t.scope === "personal";
}

export function sum(ns: number[]): number {
  return round2(ns.reduce((a, b) => a + b, 0));
}

// ---------------------------------------------------------------------------
// Who owes who
// ---------------------------------------------------------------------------

/** Net position per member across all shared expenses + settlements. Positive = is owed. */
export function memberNets(txs: Tx[]): Record<string, number> {
  const net: Record<string, number> = {};
  for (const t of txs) {
    const counts =
      (t.type === "expense" && t.scope === "shared" && t.kind !== "contribution") ||
      isSettlement(t);
    if (!counts) continue;
    if (!t.splits.length) continue;
    if (t.paid_by) net[t.paid_by] = round2((net[t.paid_by] ?? 0) + t.amount);
    for (const s of t.splits) {
      net[s.user_id] = round2((net[s.user_id] ?? 0) - s.share_amount);
    }
  }
  return net;
}

/**
 * For a two-person household: { owedTo, owedBy, amount } or null when square.
 * With more members it returns the largest creditor/debtor pair as a summary.
 */
export function whoOwesWho(
  txs: Tx[],
): { owedTo: string; owedBy: string; amount: number } | null {
  const net = memberNets(txs);
  const entries = Object.entries(net).filter(([, v]) => Math.abs(v) >= 0.01);
  if (entries.length < 2) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const [creditor, credit] = entries[0];
  const [debtor] = entries[entries.length - 1];
  if (credit < 0.01) return null;
  return { owedTo: creditor, owedBy: debtor, amount: round2(credit) };
}

// ---------------------------------------------------------------------------
// Monthly summaries
// ---------------------------------------------------------------------------

export function householdExpenses(txs: Tx[], ym: string): Tx[] {
  return txs.filter((t) => inMonth(t, ym) && isHouseholdExpense(t));
}

export function totalHouseholdExpenses(txs: Tx[], ym: string): number {
  return sum(householdExpenses(txs, ym).map((t) => t.amount));
}

/** What each member personally paid toward shared household expenses. */
export function contributionsByMember(
  txs: Tx[],
  ym: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of householdExpenses(txs, ym)) {
    if (!t.paid_by) continue;
    out[t.paid_by] = round2((out[t.paid_by] ?? 0) + t.amount);
  }
  return out;
}

export function byKind(txs: Tx[], ym: string, kind: Tx["kind"]): Tx[] {
  return txs.filter((t) => inMonth(t, ym) && t.kind === kind);
}

export function totalByKind(txs: Tx[], ym: string, kind: Tx["kind"]): number {
  return sum(byKind(txs, ym, kind).map((t) => t.amount));
}

/** Shared expense totals grouped by category name. */
export function categoryBreakdown(
  txs: Tx[],
  ym: string,
  categories: Category[],
): Array<{ name: string; total: number }> {
  const byId = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number>();
  for (const t of householdExpenses(txs, ym)) {
    const name = (t.category_id && byId.get(t.category_id)) || "Uncategorised";
    totals.set(name, round2((totals.get(name) ?? 0) + t.amount));
  }
  return [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

/** Distinct months present in the data (ascending), always including `ensure`. */
export function monthsInData(txs: Tx[], ensure?: string): string[] {
  const set = new Set(txs.map((t) => monthKey(t.occurred_on)));
  if (ensure) set.add(ensure);
  return [...set].sort();
}

// ---------------------------------------------------------------------------
// Rent
// ---------------------------------------------------------------------------

/**
 * How much of each member's rent share is covered for a month, based on the
 * splits of rent transactions tagged with meta.month. If one person pays the
 * full rent split 50/50, both are covered and the balance shows the debt.
 */
export function rentCoverage(txs: Tx[], ym: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txs) {
    if (t.kind !== "rent" || t.type !== "expense") continue;
    if ((t.meta.month ?? monthKey(t.occurred_on)) !== ym) continue;
    for (const s of t.splits) {
      out[s.user_id] = round2((out[s.user_id] ?? 0) + s.share_amount);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Business
// ---------------------------------------------------------------------------

export function businessSummary(txs: Tx[], ym?: string) {
  const pick = (kind: Tx["kind"], month?: string) =>
    sum(
      txs
        .filter((t) => t.kind === kind && (!month || inMonth(t, month)))
        .map((t) => t.amount),
    );
  const income = pick("business_income");
  const expenses = pick("business_expense");
  const contributed = pick("contribution");
  return {
    income,
    expenses,
    contributed,
    net: round2(income - expenses),
    available: round2(income - expenses - contributed),
    incomeThisMonth: ym ? pick("business_income", ym) : 0,
    contributedThisMonth: ym ? pick("contribution", ym) : 0,
  };
}

// ---------------------------------------------------------------------------
// Electricity
// ---------------------------------------------------------------------------

export function electricitySummary(txs: Tx[], ym: string) {
  const rows = byKind(txs, ym, "electricity");
  const rand = sum(rows.map((t) => t.amount));
  const kwh = round2(rows.reduce((a, t) => a + (t.meta.kwh ?? 0), 0));
  return { rand, kwh, perKwh: kwh > 0 ? round2(rand / kwh) : null };
}

// ---------------------------------------------------------------------------
// Split computation (used when saving a transaction)
// ---------------------------------------------------------------------------

export function computeEqualSplits(
  amount: number,
  memberIds: string[],
  paidBy: string | null,
): Array<{ user_id: string; share_amount: number }> {
  if (!memberIds.length) return [];
  const base = Math.floor((amount / memberIds.length) * 100) / 100;
  const splits = memberIds.map((id) => ({ user_id: id, share_amount: base }));
  const remainder = round2(amount - base * memberIds.length);
  if (remainder !== 0) {
    // give the rounding cent(s) to the payer if present, else the first member
    const target =
      splits.find((s) => s.user_id === paidBy) ?? splits[0];
    target.share_amount = round2(target.share_amount + remainder);
  }
  return splits;
}

// ---------------------------------------------------------------------------
// Dashboard flags
// ---------------------------------------------------------------------------

export type Flag = { tone: "warn" | "info"; text: string };

export function computeFlags(opts: {
  txs: Tx[];
  ym: string;
  household: Household;
  memberIds: string[];
  nameOf: (id: string) => string;
  pendingImports: number;
}): Flag[] {
  const { txs, ym, household, memberIds, nameOf, pendingImports } = opts;
  const flags: Flag[] = [];

  const coverage = rentCoverage(txs, ym);
  const unpaid = memberIds.filter(
    (id) => (coverage[id] ?? 0) < household.rent_per_person - 0.01,
  );
  if (unpaid.length) {
    flags.push({
      tone: "warn",
      text: `Rent not fully covered for ${unpaid.map(nameOf).join(" and ")} this month`,
    });
  }

  if (household.grocery_budget) {
    const groceries = totalByKind(txs, ym, "grocery");
    if (groceries > household.grocery_budget) {
      flags.push({
        tone: "warn",
        text: `Grocery spending is over budget by ${fmtR(round2(groceries - household.grocery_budget))}`,
      });
    }
  }

  // electricity unusually high vs the average of the previous three months with data
  const months = monthsInData(txs).filter((m) => m < ym).slice(-3);
  if (months.length >= 2) {
    const avg =
      months.reduce((a, m) => a + totalByKind(txs, m, "electricity"), 0) /
      months.length;
    const now = totalByKind(txs, ym, "electricity");
    if (avg > 0 && now > avg * 1.5) {
      flags.push({
        tone: "warn",
        text: "Electricity spending is unusually high this month",
      });
    }
  }

  const owes = whoOwesWho(txs);
  if (owes) {
    flags.push({
      tone: "info",
      text: `${nameOf(owes.owedBy)} owes ${nameOf(owes.owedTo)} ${fmtR(owes.amount)}`,
    });
  }

  const biz = businessSummary(txs);
  if (biz.available > 0.01) {
    flags.push({
      tone: "info",
      text: `Business funds of ${fmtR(biz.available)} have not been allocated yet`,
    });
  }

  const needsReview = txs.filter((t) => t.review_status === "needs_review").length;
  if (needsReview) {
    flags.push({ tone: "info", text: `${needsReview} transaction${needsReview > 1 ? "s" : ""} waiting for review` });
  }
  if (pendingImports) {
    flags.push({
      tone: "info",
      text: `${pendingImports} imported bank transaction${pendingImports > 1 ? "s" : ""} need categorisation`,
    });
  }

  return flags;
}
