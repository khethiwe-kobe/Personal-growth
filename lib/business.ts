/**
 * Side-business model — the maths behind the pricing calculator.
 *
 * Mirrors `docs/service-business-plan.md`: four revenue lines (meal prep,
 * corporate lunchbox drops, swim blocks, admin retainer) plus a digital layer,
 * each reduced to monthly revenue, cost, profit and — the number that actually
 * matters when you have a full-time job — rand earned per hour of your time.
 */

export interface BizModel {
  /** Delivery weeks you actually work in a month. 4 = a week off each quarter. */
  weeksPerMonth: number;

  // ── Meal prep ──────────────────────────────────────────────────────────
  mpCore: number;
  mpPremium: number;
  mpMealsPerClient: number;
  mpCorePrice: number;
  mpPremiumPrice: number;
  mpCogs: number;
  mpFixed: number;
  mpHelper: number;
  mpHours: number;
  mpConsults: number;
  mpConsultPrice: number;

  // ── Corporate lunchbox drop ────────────────────────────────────────────
  corpOn: boolean;
  corpHeads: number;
  corpDrops: number;
  corpPrice: number;
  corpHours: number;

  // ── Swim blocks ────────────────────────────────────────────────────────
  swOn: boolean;
  swAdultSlots: number;
  swAdultSize: number;
  swAdultBlock: number;
  swKidSlots: number;
  swKidSize: number;
  swKidBlock: number;
  swFill: number;
  swBlockWeeks: number;
  swPoolRate: number;
  swFixed: number;
  swAdminHours: number;

  // ── "Sorted" admin retainer ────────────────────────────────────────────
  soLite: number;
  soLitePrice: number;
  soPlus: number;
  soPlusPrice: number;
  soPower: number;
  soPowerPrice: number;
  soFixed: number;
  soHours: number;

  // ── Digital products ───────────────────────────────────────────────────
  dgPdf: number;
  dgPdfPrice: number;
  dgCourse: number;
  dgCoursePrice: number;
  dgFeePct: number;

  // ── Whole business ─────────────────────────────────────────────────────
  startupCost: number;
  targetIncome: number;
}

/** Figures from `docs/service-business-plan.md` at the "target" scale. */
export const DEFAULT_MODEL: BizModel = {
  weeksPerMonth: 4,

  mpCore: 3,
  mpPremium: 3,
  mpMealsPerClient: 10,
  mpCorePrice: 125,
  mpPremiumPrice: 150,
  mpCogs: 54,
  mpFixed: 1550,
  mpHelper: 0,
  mpHours: 7,
  mpConsults: 2,
  mpConsultPrice: 650,

  corpOn: false,
  corpHeads: 15,
  corpDrops: 2,
  corpPrice: 135,
  corpHours: 2,

  swOn: true,
  swAdultSlots: 3,
  swAdultSize: 4,
  swAdultBlock: 1680,
  swKidSlots: 2,
  swKidSize: 6,
  swKidBlock: 1080,
  swFill: 75,
  swBlockWeeks: 6,
  swPoolRate: 300,
  swFixed: 750,
  swAdminHours: 1,

  soLite: 6,
  soLitePrice: 650,
  soPlus: 3,
  soPlusPrice: 1500,
  soPower: 2,
  soPowerPrice: 750,
  soFixed: 400,
  soHours: 14,

  dgPdf: 15,
  dgPdfPrice: 249,
  dgCourse: 6,
  dgCoursePrice: 499,
  dgFeePct: 4,

  startupCost: 28000,
  targetIncome: 40000,
};

export interface LineResult {
  id: string;
  name: string;
  /** Money in, per month. */
  revenue: number;
  /** Ingredients, pool hire, fees — everything that scales with volume. */
  variable: number;
  /** Insurance, marketing, admin — everything that does not. */
  fixed: number;
  /** revenue − variable − fixed. */
  net: number;
  /** Hours of *your* time per week. */
  hours: number;
  /** Net profit per hour of your time. Null when the line costs you no hours. */
  perHour: number | null;
  /** What the variable cost actually is on this line. */
  variableLabel: string;
  /** One-line explanation of where the revenue comes from. */
  note: string;
  active: boolean;
}

const round = (n: number) => Math.round(n) || 0;
const safe = (n: number) => (Number.isFinite(n) ? n : 0);

function line(
  id: string,
  name: string,
  revenue: number,
  variable: number,
  variableLabel: string,
  fixed: number,
  hours: number,
  note: string,
  active: boolean,
  weeksPerMonth: number,
): LineResult {
  const net = revenue - variable - fixed;
  const monthlyHours = hours * weeksPerMonth;
  return {
    id,
    name,
    revenue: round(revenue),
    variable: round(variable),
    variableLabel,
    fixed: round(fixed),
    net: round(net),
    hours: safe(Math.round(hours * 10) / 10),
    perHour: monthlyHours > 0 ? round(net / monthlyHours) : null,
    note,
    active,
  };
}

export function mealPrep(m: BizModel): LineResult {
  const w = m.weeksPerMonth;
  const clients = m.mpCore + m.mpPremium;
  const mealsWeek = clients * m.mpMealsPerClient;
  const revWeek = m.mpMealsPerClient * (m.mpCore * m.mpCorePrice + m.mpPremium * m.mpPremiumPrice);
  const revenue = revWeek * w + m.mpConsults * m.mpConsultPrice;
  const variable = mealsWeek * m.mpCogs * w;
  return line(
    "meals",
    "Meal prep",
    revenue,
    variable,
    "Ingredients",
    m.mpFixed + m.mpHelper,
    m.mpHours,
    `${clients} client${clients === 1 ? "" : "s"} · ${round(mealsWeek)} meals a week`,
    clients > 0,
    w,
  );
}

export function corporate(m: BizModel): LineResult {
  const w = m.weeksPerMonth;
  const mealsWeek = m.corpHeads * m.corpDrops;
  const revenue = m.corpOn ? mealsWeek * m.corpPrice * w : 0;
  const variable = m.corpOn ? mealsWeek * m.mpCogs * w : 0;
  return line(
    "corp",
    "Corporate drop",
    revenue,
    variable,
    "Ingredients",
    0,
    m.corpOn ? m.corpHours : 0,
    `${m.corpHeads} people × ${m.corpDrops} drop${m.corpDrops === 1 ? "" : "s"} a week · one stop`,
    m.corpOn,
    w,
  );
}

export function swim(m: BizModel): LineResult {
  const w = m.weeksPerMonth;
  const fill = m.swFill / 100;
  const weeks = Math.max(1, m.swBlockWeeks);
  const adultWeek = m.swAdultSlots * m.swAdultSize * fill * (m.swAdultBlock / weeks);
  const kidWeek = m.swKidSlots * m.swKidSize * fill * (m.swKidBlock / weeks);
  const contactHours = m.swAdultSlots + m.swKidSlots;
  const revenue = m.swOn ? (adultWeek + kidWeek) * w : 0;
  const variable = m.swOn ? contactHours * m.swPoolRate * w : 0;
  const places = Math.round((m.swAdultSlots * m.swAdultSize + m.swKidSlots * m.swKidSize) * fill);
  return line(
    "swim",
    "Swim blocks",
    revenue,
    variable,
    "Pool hire",
    m.swOn ? m.swFixed : 0,
    m.swOn ? contactHours + m.swAdminHours : 0,
    `${places} swimmers · ${contactHours}h in the water a week`,
    m.swOn,
    w,
  );
}

export function sorted(m: BizModel): LineResult {
  const revenue = m.soLite * m.soLitePrice + m.soPlus * m.soPlusPrice + m.soPower * m.soPowerPrice;
  const clients = m.soLite + m.soPlus;
  return line(
    "sorted",
    "Admin retainer",
    revenue,
    0,
    "Costs",
    m.soFixed,
    m.soHours / m.weeksPerMonth,
    `${clients} retainer client${clients === 1 ? "" : "s"} · ${m.soPower} power hour${m.soPower === 1 ? "" : "s"}`,
    revenue > 0,
    m.weeksPerMonth,
  );
}

export function digital(m: BizModel): LineResult {
  const revenue = m.dgPdf * m.dgPdfPrice + m.dgCourse * m.dgCoursePrice;
  return line(
    "digital",
    "Digital products",
    revenue,
    revenue * (m.dgFeePct / 100),
    "Payment fees",
    0,
    0,
    `${m.dgPdf} plans + ${m.dgCourse} courses · built once`,
    revenue > 0,
    m.weeksPerMonth,
  );
}

export interface BizSummary {
  lines: LineResult[];
  active: LineResult[];
  revenue: number;
  net: number;
  hours: number;
  perHour: number;
  /** Net excluding swim — what a Joburg winter looks like. */
  winterNet: number;
  winterHours: number;
  /** Months of profit to repay the startup capital. */
  payback: number;
  /** Distance from the income you said you wanted. */
  gap: number;
  /** Extra meal-prep clients that would close that gap. */
  clientsToTarget: number;
}

export function summarise(m: BizModel): BizSummary {
  const lines = [mealPrep(m), corporate(m), swim(m), sorted(m), digital(m)];
  const active = lines.filter((l) => l.active);
  const revenue = active.reduce((s, l) => s + l.revenue, 0);
  const net = active.reduce((s, l) => s + l.net, 0);
  const hours = active.reduce((s, l) => s + l.hours, 0);
  const monthlyHours = hours * m.weeksPerMonth;

  const sw = lines.find((l) => l.id === "swim")!;
  const gap = Math.max(0, m.targetIncome - net);

  // What one more Core meal-prep client is worth, after ingredients.
  const perClient = m.mpMealsPerClient * (m.mpCorePrice - m.mpCogs) * m.weeksPerMonth;

  return {
    lines,
    active,
    revenue: round(revenue),
    net: round(net),
    hours: Math.round(hours * 10) / 10,
    perHour: monthlyHours > 0 ? round(net / monthlyHours) : 0,
    winterNet: round(net - (sw.active ? sw.net : 0)),
    winterHours: Math.round((hours - (sw.active ? sw.hours : 0)) * 10) / 10,
    payback: net > 0 ? Math.round((m.startupCost / net) * 10) / 10 : 0,
    gap: round(gap),
    clientsToTarget: perClient > 0 ? Math.ceil(gap / perClient) : 0,
  };
}

/** Smallest client count where meal prep stops losing money. */
export function mealBreakEven(m: BizModel): number {
  const perClient = m.mpMealsPerClient * (m.mpCorePrice - m.mpCogs) * m.weeksPerMonth;
  if (perClient <= 0) return 0;
  return Math.ceil((m.mpFixed + m.mpHelper) / perClient);
}

export function rand(n: number): string {
  return `R${Math.round(n).toLocaleString("en-ZA")}`;
}
