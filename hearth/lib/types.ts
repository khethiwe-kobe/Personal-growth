export type Profile = {
  id: string;
  full_name: string;
  display_name: string;
  avatar_path: string | null;
};

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  rent_total: number;
  rent_per_person: number;
  monthly_budget: number | null;
  grocery_budget: number | null;
};

export type Category = {
  id: string;
  household_id: string;
  name: string;
  kind: "expense" | "income";
  sort: number;
};

export type TxScope = "shared" | "personal" | "business";
export type TxType = "expense" | "income";
export type TxKind =
  | "general"
  | "rent"
  | "grocery"
  | "electricity"
  | "transport"
  | "business_income"
  | "business_expense"
  | "contribution"
  | "settlement";
export type SplitType = "none" | "equal" | "custom";

export type Split = {
  transaction_id: string;
  user_id: string;
  share_amount: number;
};

export type TxMeta = {
  month?: string; // rent: "2026-08"
  store?: string; // groceries
  kwh?: number; // electricity
  transport_type?: string;
  purpose?: string;
  client?: string; // business income
  service?: string;
  payment_status?: "paid" | "pending";
};

export type Tx = {
  id: string;
  household_id: string;
  occurred_on: string;
  description: string;
  category_id: string | null;
  amount: number;
  type: TxType;
  scope: TxScope;
  kind: TxKind;
  paid_by: string | null;
  split_type: SplitType;
  receipt_path: string | null;
  notes: string | null;
  meta: TxMeta;
  review_status: "approved" | "needs_review";
  source: "manual" | "import";
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  splits: Split[];
};

export type GroceryItem = {
  id: string;
  household_id: string;
  name: string;
  quantity: string;
  category: string;
  est_price: number | null;
  actual_price: number | null;
  purchased: boolean;
  purchased_by: string | null;
  transaction_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type Meal = {
  id: string;
  household_id: string;
  name: string;
  category: string;
  ingredients: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type MealPlanEntry = {
  id: string;
  household_id: string;
  week_start: string;
  day: number;
  slot: "breakfast" | "lunch" | "dinner";
  meal_id: string;
};

export type Statement = {
  id: string;
  household_id: string;
  file_name: string;
  file_path: string | null;
  status: "uploaded" | "processed";
  uploaded_by: string | null;
  created_at: string;
};

export type ImportedTx = {
  id: string;
  household_id: string;
  statement_id: string | null;
  occurred_on: string;
  description: string;
  amount: number;
  type: TxType;
  suggested_category: string | null;
  status: "pending" | "approved" | "dismissed";
  transaction_id: string | null;
  created_at: string;
};

export type ActivityEntry = {
  id: number;
  household_id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
};

// Supabase returns numeric columns as strings; normalise on fetch.
export function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function normTx(row: any): Tx {
  return {
    ...row,
    amount: num(row.amount),
    meta: row.meta ?? {},
    splits: (row.splits ?? []).map((s: any) => ({
      ...s,
      share_amount: num(s.share_amount),
    })),
  } as Tx;
}

export function normHousehold(row: any): Household {
  return {
    ...row,
    rent_total: num(row.rent_total),
    rent_per_person: num(row.rent_per_person),
    monthly_budget: numOrNull(row.monthly_budget),
    grocery_budget: numOrNull(row.grocery_budget),
  } as Household;
}

export function normGroceryItem(row: any): GroceryItem {
  return {
    ...row,
    est_price: numOrNull(row.est_price),
    actual_price: numOrNull(row.actual_price),
  } as GroceryItem;
}

export function normImportedTx(row: any): ImportedTx {
  return { ...row, amount: num(row.amount) } as ImportedTx;
}

export function normMeal(row: any): Meal {
  return {
    ...row,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
  } as Meal;
}
