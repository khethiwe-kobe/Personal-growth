"use client";

/*
 * Demo mode: an in-memory stand-in for the Supabase client, active only when
 * NEXT_PUBLIC_DEMO=1. It implements just the query surface this app uses
 * (select/eq/in/order/limit/single, insert/update/upsert/delete, count-head,
 * the two embedded joins, auth session, storage stubs) over seeded sample
 * data, so the whole UI can be previewed — and interacted with — without a
 * database. Nothing persists across a page reload.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
type DB = Record<string, Row[]>;

const YOU = "demo-user-khethiwe";
const KB = "demo-user-kb";
const HH = "demo-household";

let idCounter = 1000;
const genId = () => `demo-${idCounter++}`;

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

function seed(): DB {
  const db: DB = {
    profiles: [
      { id: YOU, full_name: "Khethiwe Kobe", display_name: "Khethiwe", avatar_path: null, created_at: "2026-05-01T08:00:00Z" },
      { id: KB, full_name: "Kabelo Kgoele", display_name: "KB", avatar_path: null, created_at: "2026-05-01T09:00:00Z" },
    ],
    households: [
      {
        id: HH, name: "Kobe & Kgoele home", invite_code: "4F7A2C",
        rent_total: 8800, rent_per_person: 4400,
        monthly_budget: 14000, grocery_budget: 2600,
        created_by: YOU, created_at: "2026-05-01T08:05:00Z",
      },
    ],
    household_members: [
      { household_id: HH, user_id: YOU, role: "owner", joined_at: "2026-05-01T08:05:00Z" },
      { household_id: HH, user_id: KB, role: "member", joined_at: "2026-05-01T10:00:00Z" },
    ],
    categories: [
      "Rent|expense", "Groceries|expense", "Electricity|expense", "Transport|expense",
      "Household|expense", "Eating out|expense", "Other|expense",
      "Business income|income", "Other income|income",
    ].map((s, i) => {
      const [name, kind] = s.split("|");
      return { id: `demo-cat-${name.toLowerCase().replace(/ /g, "-")}`, household_id: HH, name, kind, sort: i + 1 };
    }),
    transactions: [],
    transaction_splits: [],
    grocery_items: [],
    meals: [],
    meal_plan: [],
    statements: [],
    imported_transactions: [],
    activity_log: [],
  };

  const cat = (name: string) => db.categories.find((c) => c.name === name)!.id;

  let n = 0;
  const tx = (o: {
    d: string; desc: string; amount: number; cat?: string;
    type?: "expense" | "income"; scope?: "shared" | "personal" | "business";
    kind?: string; paid?: string | null;
    split?: "equal" | "own" | "custom"; shares?: Array<[string, number]>;
    meta?: Row; notes?: string; receipt?: boolean; by?: string;
  }) => {
    n++;
    const id = `demo-tx-${n}`;
    const type = o.type ?? "expense";
    const scope = o.scope ?? "shared";
    const split = o.split ?? (scope === "shared" && type === "expense" ? "equal" : undefined);
    db.transactions.push({
      id, household_id: HH, occurred_on: o.d, description: o.desc,
      category_id: o.cat ? cat(o.cat) : null, amount: o.amount, type, scope,
      kind: o.kind ?? "general", paid_by: o.paid === undefined ? YOU : o.paid,
      split_type: split === "equal" ? "equal" : split === "custom" ? "custom" : "none",
      receipt_path: o.receipt ? `${HH}/demo/receipt-${n}.png` : null,
      notes: o.notes ?? null, meta: o.meta ?? {},
      review_status: "approved", source: "manual",
      created_by: o.by ?? o.paid ?? YOU, created_at: `${o.d}T18:00:00Z`,
      updated_by: null, updated_at: `${o.d}T18:00:00Z`,
    });
    const paid = o.paid === undefined ? YOU : o.paid;
    if (scope === "shared" && type === "expense") {
      if (split === "equal") {
        const half = Math.round((o.amount / 2) * 100) / 100;
        db.transaction_splits.push(
          { transaction_id: id, user_id: YOU, share_amount: paid === YOU ? Math.round((o.amount - half) * 100) / 100 : half },
          { transaction_id: id, user_id: KB, share_amount: paid === KB ? Math.round((o.amount - half) * 100) / 100 : half },
        );
      } else if (split === "custom" && o.shares) {
        for (const [uid, amt] of o.shares) db.transaction_splits.push({ transaction_id: id, user_id: uid, share_amount: amt });
      } else if (split === "own" && paid) {
        db.transaction_splits.push({ transaction_id: id, user_id: paid, share_amount: o.amount });
      }
    }
    return id;
  };

  // --- May to July: history for trends -----------------------------------
  const history: Array<[string, number, number, number, number, number, number]> = [
    // month, groceriesA, groceriesB, elec1(kwh), elec2(kwh), transport, other
    ["2026-05", 980.4, 1240.6, 250, 300, 420, 549],
    ["2026-06", 1105.2, 1310.9, 300, 250, 515, 549],
    ["2026-07", 1260.75, 1385.3, 350, 300, 610, 599],
  ];
  for (const [m, gA, gB, e1, e2, tr, other] of history) {
    tx({ d: `${m}-01`, desc: `Rent — ${m}`, amount: 4400, cat: "Rent", kind: "rent", paid: YOU, split: "own", meta: { month: m, payment_status: "paid" } });
    tx({ d: `${m}-02`, desc: `Rent — ${m}`, amount: 4400, cat: "Rent", kind: "rent", paid: KB, split: "own", meta: { month: m, payment_status: "paid" } });
    tx({ d: `${m}-06`, desc: "Weekly groceries", amount: gA, cat: "Groceries", kind: "grocery", paid: YOU, meta: { store: "Checkers" } });
    tx({ d: `${m}-20`, desc: "Weekly groceries", amount: gB, cat: "Groceries", kind: "grocery", paid: KB, meta: { store: "Pick n Pay" } });
    tx({ d: `${m}-04`, desc: "Prepaid electricity", amount: e1, cat: "Electricity", kind: "electricity", paid: KB, meta: { kwh: Math.round((e1 / 4.9) * 10) / 10 } });
    tx({ d: `${m}-18`, desc: "Prepaid electricity", amount: e2, cat: "Electricity", kind: "electricity", paid: YOU, meta: { kwh: Math.round((e2 / 4.9) * 10) / 10 } });
    tx({ d: `${m}-11`, desc: "Petrol", amount: tr, cat: "Transport", kind: "transport", paid: YOU, meta: { transport_type: "Petrol", purpose: "Month's shared trips" } });
    tx({ d: `${m}-03`, desc: "Fibre internet", amount: other, cat: "Household", paid: KB });
  }
  // business ramping up
  tx({ d: "2026-06-21", desc: "Meal prep order", amount: 800, cat: "Business income", type: "income", scope: "business", kind: "business_income", paid: YOU, meta: { client: "Naledi M.", service: "Meal prep, 5 meals", payment_status: "paid" } });
  tx({ d: "2026-07-12", desc: "Meal prep order", amount: 1400, cat: "Business income", type: "income", scope: "business", kind: "business_income", paid: KB, meta: { client: "Thabo S.", service: "Meal prep, 10 meals", payment_status: "paid" } });
  tx({ d: "2026-07-13", desc: "Ingredients for orders", amount: 480, scope: "business", kind: "business_expense", paid: YOU, meta: { purpose: "Ingredients" } });
  tx({ d: "2026-07-28", desc: "Business contribution to household", amount: 1500, type: "income", scope: "shared", kind: "contribution", paid: null, split: undefined, notes: "Toward July groceries" });

  // --- August (current month) ---------------------------------------------
  tx({ d: "2026-08-01", desc: "Rent — 2026-08", amount: 4400, cat: "Rent", kind: "rent", paid: YOU, split: "own", meta: { month: "2026-08", payment_status: "paid" }, receipt: true });
  tx({ d: "2026-08-02", desc: "Rent — 2026-08", amount: 4400, cat: "Rent", kind: "rent", paid: KB, split: "own", meta: { month: "2026-08", payment_status: "paid" } });
  tx({ d: "2026-08-02", desc: "Fibre internet", amount: 599, cat: "Household", paid: KB });
  const shop1 = tx({ d: "2026-08-03", desc: "Weekly groceries", amount: 862.45, cat: "Groceries", kind: "grocery", paid: YOU, meta: { store: "Checkers" }, receipt: true });
  tx({ d: "2026-08-05", desc: "Prepaid electricity", amount: 300, cat: "Electricity", kind: "electricity", paid: KB, meta: { kwh: 62.4 }, receipt: true });
  tx({ d: "2026-08-07", desc: "Meal prep order", amount: 1500, cat: "Business income", type: "income", scope: "business", kind: "business_income", paid: YOU, meta: { client: "Naledi M.", service: "Meal prep, 10 meals", payment_status: "paid" } });
  tx({ d: "2026-08-06", desc: "Ingredients for Naledi's order", amount: 620, scope: "business", kind: "business_expense", paid: YOU, meta: { purpose: "Ingredients" } });
  tx({ d: "2026-08-08", desc: "Trip to the market", amount: 89.5, cat: "Transport", kind: "transport", paid: YOU, meta: { transport_type: "Uber", purpose: "Groceries run" } });
  tx({ d: "2026-08-09", desc: "Top-up shop", amount: 435.2, cat: "Groceries", kind: "grocery", paid: KB, meta: { store: "Woolworths" } });
  tx({ d: "2026-08-10", desc: "Petrol", amount: 450, cat: "Transport", kind: "transport", paid: YOU, meta: { transport_type: "Petrol", purpose: "Shared trips" } });
  tx({ d: "2026-08-11", desc: "Settlement — KB paid Khethiwe", amount: 500, kind: "settlement", paid: KB, split: "custom", shares: [[YOU, 500]] });
  tx({ d: "2026-08-13", desc: "Packaging containers", amount: 180, scope: "business", kind: "business_expense", paid: KB, meta: { purpose: "Packaging" } });
  tx({ d: "2026-08-14", desc: "Evening out", amount: 120, cat: "Transport", kind: "transport", paid: KB, meta: { transport_type: "Bolt", purpose: "Dinner with friends" } });
  tx({ d: "2026-08-04", desc: "Gym membership", amount: 349, cat: "Other", scope: "personal", paid: YOU });
  const shop2 = tx({ d: "2026-08-16", desc: "Monthly big shop", amount: 1120.8, cat: "Groceries", kind: "grocery", paid: YOU, meta: { store: "Pick n Pay" }, receipt: true });
  tx({ d: "2026-08-15", desc: "Meal prep order", amount: 1800, cat: "Business income", type: "income", scope: "business", kind: "business_income", paid: KB, meta: { client: "Thabo S.", service: "Meal prep, 12 meals", payment_status: "pending" } });
  tx({ d: "2026-08-16", desc: "Business contribution to household", amount: 1000, type: "income", scope: "shared", kind: "contribution", paid: null, notes: "Toward August electricity and groceries" });
  tx({ d: "2026-08-19", desc: "Prepaid electricity", amount: 200, cat: "Electricity", kind: "electricity", paid: YOU, meta: { kwh: 40.5 }, receipt: true });

  // --- Grocery list ---------------------------------------------------------
  const item = (o: Row) => db.grocery_items.push({
    id: genId(), household_id: HH, quantity: "1", category: "Other",
    est_price: null, actual_price: null, purchased: false, purchased_by: null,
    transaction_id: null, created_by: YOU, created_at: "2026-08-17T09:00:00Z", ...o,
  });
  item({ name: "Chicken thighs", quantity: "2kg", category: "Meat", est_price: 145 });
  item({ name: "Rice", quantity: "2kg", category: "Pantry", est_price: 65 });
  item({ name: "Spinach", category: "Vegetables", est_price: 25, created_by: KB });
  item({ name: "Milk", quantity: "2L", category: "Dairy", est_price: 42 });
  item({ name: "Dishwashing liquid", category: "Cleaning", est_price: 35, created_by: KB });
  item({ name: "Coffee", quantity: "250g", category: "Drinks", est_price: 89 });
  item({ name: "Eggs", quantity: "18", category: "Dairy", est_price: 55, actual_price: 58, purchased: true, purchased_by: YOU, transaction_id: shop2, created_at: "2026-08-14T09:00:00Z" });
  item({ name: "Bread", category: "Pantry", est_price: 20, actual_price: 22, purchased: true, purchased_by: YOU, transaction_id: shop2, created_at: "2026-08-14T09:00:00Z" });
  item({ name: "Apples", quantity: "1.5kg", category: "Fruit", est_price: 30, actual_price: 28, purchased: true, purchased_by: KB, transaction_id: shop1, created_at: "2026-08-01T09:00:00Z" });

  // --- Meals + planner -------------------------------------------------------
  const meal = (name: string, category: string, ingredients: string[], notes?: string) => {
    const id = genId();
    db.meals.push({ id, household_id: HH, name, category, ingredients, notes: notes ?? null, created_by: YOU, created_at: "2026-08-01T10:00:00Z" });
    return id;
  };
  const mCurry = meal("Chicken curry", "Dinner", ["Chicken thighs", "Rice", "Curry paste", "Coconut milk", "Onions"], "KB's favourite — double the batch for lunches.");
  const mOats = meal("Overnight oats", "Breakfast", ["Oats", "Milk", "Honey", "Apples"]);
  const mStew = meal("Beef stew", "Dinner", ["Stewing beef", "Potatoes", "Carrots", "Onions", "Beef stock"]);
  const mWraps = meal("Chickpea wraps", "Lunch", ["Chickpeas", "Wraps", "Spinach", "Yoghurt"], "Quick weekday lunch.");
  const mSoup = meal("Butternut soup", "Dinner", ["Butternut", "Onions", "Cream", "Vegetable stock"]);
  meal("Eggs on toast", "Breakfast", ["Eggs", "Bread", "Butter"]);

  const WEEK = "2026-08-17"; // Monday of the current demo week
  const plan = (day: number, slot: string, mealId: string) =>
    db.meal_plan.push({ id: genId(), household_id: HH, week_start: WEEK, day, slot, meal_id: mealId });
  plan(0, "breakfast", mOats); plan(0, "dinner", mCurry);
  plan(1, "lunch", mWraps); plan(1, "dinner", mStew);
  plan(2, "breakfast", mOats); plan(2, "dinner", mSoup);
  plan(3, "lunch", mWraps); plan(4, "dinner", mCurry);

  // --- Joint account: statement + imports -----------------------------------
  const stId = genId();
  db.statements.push({ id: stId, household_id: HH, file_name: "joint-account-august.csv", file_path: `${HH}/statements/joint-account-august.csv`, status: "processed", uploaded_by: KB, created_at: "2026-08-18T14:00:00Z" });
  const imp = (o: Row) => db.imported_transactions.push({
    id: genId(), household_id: HH, statement_id: stId, status: "pending",
    transaction_id: null, created_at: "2026-08-18T14:00:00Z", ...o,
  });
  imp({ occurred_on: "2026-08-12", description: "CHECKERS SANDTON", amount: 850, type: "expense", suggested_category: "Groceries" });
  imp({ occurred_on: "2026-08-13", description: "UBER *TRIP", amount: 76.4, type: "expense", suggested_category: "Transport" });
  imp({ occurred_on: "2026-08-15", description: "EFT DEPOSIT — MEAL PREP", amount: 1800, type: "income", suggested_category: "Business income" });
  imp({ occurred_on: "2026-08-10", description: "NETFLIX.COM", amount: 199, type: "expense", suggested_category: "Other", status: "approved" });
  imp({ occurred_on: "2026-08-09", description: "BANK FEES", amount: 55, type: "expense", suggested_category: "Other", status: "dismissed" });

  // --- Activity trail --------------------------------------------------------
  const act = (user: string, summary: string, at: string) =>
    db.activity_log.push({ id: db.activity_log.length + 1, household_id: HH, user_id: user, action: "add", entity: "transaction", entity_id: null, summary, created_at: at });
  act(YOU, 'added rent payment "Rent — 2026-08" — R4,400.00, paid by You', "2026-08-01T08:12:00Z");
  act(KB, 'added rent payment "Rent — 2026-08" — R4,400.00, paid by KB', "2026-08-02T09:30:00Z");
  act(YOU, 'added grocery expense "Weekly groceries" — R862.45, paid by You', "2026-08-03T17:40:00Z");
  act(KB, 'added electricity purchase "Prepaid electricity" — R300.00, paid by KB', "2026-08-05T07:55:00Z");
  act(YOU, 'added business income "Meal prep order" — R1,500.00, paid by You', "2026-08-07T12:00:00Z");
  act(KB, 'added settlement "Settlement — KB paid Khethiwe" — R500.00, paid by KB', "2026-08-11T19:05:00Z");
  act(YOU, 'edited electricity purchase "Prepaid electricity" (R200.00) — changed amount R180.00 to R200.00', "2026-08-19T20:31:00Z");
  act(KB, 'uploaded a bank statement "joint-account-august.csv" — 5 transactions to review', "2026-08-18T14:01:00Z");
  act(YOU, 'approved imported transaction "NETFLIX.COM" (R199.00) as Other', "2026-08-18T14:10:00Z");
  act(KB, 'added grocery item "Spinach"', "2026-08-17T08:20:00Z");

  return db;
}

// ---------------------------------------------------------------------------
// Query builder over the in-memory DB
// ---------------------------------------------------------------------------

class DemoQuery implements PromiseLike<any> {
  private filters: Array<(r: Row) => boolean> = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: any = null;
  private conflictCols: string[] | null = null;
  private wantSingle = false;
  private wantCount = false;
  private selectCols = "*";
  private returning = false;

  constructor(private db: DB, private table: string) {}

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.mode === "select") {
      this.selectCols = cols;
      if (opts?.count) this.wantCount = true;
    } else {
      this.returning = true;
      this.selectCols = cols;
    }
    return this;
  }
  insert(payload: any) { this.mode = "insert"; this.payload = payload; return this; }
  update(payload: any) { this.mode = "update"; this.payload = payload; return this; }
  upsert(payload: any, opts?: { onConflict?: string }) {
    this.mode = "upsert"; this.payload = payload;
    this.conflictCols = opts?.onConflict?.split(",").map((s) => s.trim()) ?? null;
    return this;
  }
  delete() { this.mode = "delete"; return this; }
  eq(col: string, val: any) { this.filters.push((r) => r[col] === val); return this; }
  in(col: string, vals: any[]) { const s = new Set(vals); this.filters.push((r) => s.has(r[col])); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.limitN = n; return this; }
  single() { this.wantSingle = true; return this; }

  private embed(rows: Row[]): Row[] {
    if (this.table === "transactions" && this.selectCols.includes("splits:")) {
      return rows.map((r) => ({
        ...r,
        splits: this.db.transaction_splits.filter((s) => s.transaction_id === r.id),
      }));
    }
    if (this.table === "household_members" && this.selectCols.includes("profile:")) {
      return rows.map((r) => ({
        ...r,
        profile: this.db.profiles.find((p) => p.id === r.user_id) ?? null,
      }));
    }
    return rows;
  }

  private run(): { data: any; error: any; count?: number } {
    const rows = this.db[this.table] ?? [];
    const matches = () => rows.filter((r) => this.filters.every((f) => f(r)));

    if (this.mode === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = list.map((p) => {
        const row: Row = { id: genId(), created_at: new Date().toISOString(), ...p };
        if (this.table === "transactions") row.updated_at = row.created_at;
        if (this.table === "activity_log") row.id = rows.length + Math.random();
        rows.push(row);
        return row;
      });
      const data = this.returning ? this.embed(inserted) : null;
      return { data: this.wantSingle ? (data?.[0] ?? inserted[0]) : data, error: null };
    }

    if (this.mode === "upsert") {
      const p = this.payload as Row;
      let row = this.conflictCols
        ? rows.find((r) => this.conflictCols!.every((c) => r[c] === p[c]))
        : undefined;
      if (row) Object.assign(row, p);
      else {
        row = { id: genId(), created_at: new Date().toISOString(), ...p };
        rows.push(row);
      }
      return { data: this.wantSingle ? row : [row], error: null };
    }

    if (this.mode === "update") {
      const hit = matches();
      for (const r of hit) Object.assign(r, this.payload);
      const data = this.returning ? this.embed(hit) : null;
      return { data: this.wantSingle ? (data?.[0] ?? null) : data, error: null };
    }

    if (this.mode === "delete") {
      const hit = new Set(matches());
      this.db[this.table] = rows.filter((r) => !hit.has(r));
      return { data: null, error: null };
    }

    // select
    let out = matches();
    if (this.wantCount) return { data: null, error: null, count: out.length };
    for (const o of [...this.orders].reverse()) {
      out = [...out].sort((a, b) => {
        const x = a[o.col], y = b[o.col];
        const c = x === y ? 0 : x < y ? -1 : 1;
        return o.asc ? c : -c;
      });
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    out = this.embed(out.map((r) => ({ ...r })));
    if (this.wantSingle) return { data: out[0] ?? null, error: out.length ? null : { message: "No rows" } };
    return { data: out, error: null };
  }

  then<T1 = any, T2 = never>(
    onfulfilled?: ((value: any) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

// ---------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------

const RECEIPT_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560"><rect width="100%" height="100%" fill="#f7f4ee"/><text x="50%" y="48%" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#8b8175">Demo receipt</text><text x="50%" y="55%" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#b5ab9a">Uploads work once Supabase is connected</text></svg>`,
  );

export function createDemoClient(): any {
  const db = seed();
  const user = { id: YOU, email: "khethiwe@example.com" };
  const session = { user };

  const onLoginScreen = () =>
    typeof window !== "undefined" &&
    (window.location.pathname === "/login" || window.location.pathname === "/onboarding");

  return {
    from: (table: string) => new DemoQuery(db, table),
    rpc: async () => ({ data: null, error: { message: "Not available in demo mode — connect Supabase to create or join a household." } }),
    auth: {
      getSession: async () => ({ data: { session: onLoginScreen() ? null : session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: async () => ({ data: { session: null }, error: { message: "Demo mode — connect Supabase to create real accounts." } }),
      signInWithPassword: async () => ({ error: { message: "Demo mode — connect Supabase to sign in." } }),
      signOut: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: RECEIPT_PLACEHOLDER } }),
      }),
    },
  };
}
