export function fmtR(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return (
    sign +
    "R" +
    abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fmtR0(n: number): string {
  const sign = n < 0 ? "-" : "";
  return sign + "R" + Math.abs(Math.round(n)).toLocaleString("en-US");
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function monthLabelShort(ym: string): string {
  const [, m] = ym.split("-").map(Number);
  return MONTHS[m - 1].slice(0, 3);
}

export function fmtDate(dateISO: string): string {
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function fmtDateTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Monday of the week containing the given date. */
export function weekStartISO(date = new Date()): string {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftWeek(weekISO: string, deltaWeeks: number): string {
  const [y, m, d] = weekISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaWeeks * 7);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function weekLabel(weekISO: string): string {
  const [y, m, d] = weekISO.split("-").map(Number);
  const end = new Date(y, m - 1, d + 6);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} – ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
}
