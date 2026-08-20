# Hearth — shared household budget

A minimal, calm budget app for two people (built for Khethiwe and KB, architected for
more): shared expenses with clear splits, a running who-owes-who balance, rent tracking
(R4,400 each / R8,800 total), groceries + grocery list, meal ideas and a weekly planner
that feeds the grocery list, electricity purchases with kWh, transport, a shared
meal-prep business with contributions to the household, bank-statement (CSV) import with
review, monthly reports, and a full activity/audit trail.

Built with Next.js, TypeScript, Tailwind CSS and Supabase (Auth, Postgres with
Row Level Security, Storage for receipts/screenshots).

**Every figure is traceable**: rent, groceries, electricity, transport, business money
and settlements are all rows in one `transactions` table, and every balance on screen is
computed from those rows (`lib/money.ts`).

---

## 1. Set up Supabase (once, ~5 minutes)

1. Go to https://supabase.com → sign in → **New project**. Pick any name (e.g.
   `hearth`), a strong database password, and a region close to you.
2. Once the project is ready, open **SQL Editor** (left sidebar) → **New query** →
   paste the entire contents of [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.
   It creates all tables, security policies, the private `receipts` storage bucket, and
   the household create/join functions. It is safe to re-run.
3. Go to **Authentication → Sign In / Providers** and make sure **Email** is enabled
   (it is by default). Optional: under **Authentication → Settings**, turn OFF
   "Confirm email" if you want to skip the confirmation-email step when you two sign up.
4. Go to **Project Settings → API** (or **Data API**) and copy two values:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon / public key**

## 2. Deploy on Vercel (new project)

1. Go to https://vercel.com → **Add New… → Project**.
2. **Import** the `Personal-growth` GitHub repository (connect GitHub if asked).
3. On the configure screen:
   - **Root Directory**: click **Edit** and choose **`hearth`** ← important.
   - Framework preset: Next.js (auto-detected).
   - **Environment Variables**: add both of these (from step 1.4):
     - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**.
5. After the first deploy: **Project → Settings → Git → Production Branch** — set it to
   `claude/household-budget-app-x5ynjb` (or merge this branch into your default branch
   and leave the setting alone). Redeploy if you changed it.

## 3. First run

1. Open the deployed URL → **Create an account** (Khethiwe).
2. **Create household** → the app shows an **invite code** under Settings.
3. KB creates their account → **Join with code**.
4. Set your display names (e.g. "KB") and budgets under **Settings**.

## Local development

```bash
cd hearth
npm install
cp .env.example .env.local   # fill in the two Supabase values
npm run dev                  # http://localhost:3200
```

### Instant preview (no Supabase needed)

```bash
NEXT_PUBLIC_DEMO=1 npm run dev
```

Demo mode runs the full app against in-memory sample data (August 2026 for
Khethiwe and KB) — every page works and is interactive, nothing persists, and
a "Demo data" badge shows in the sidebar. Never set this flag on a real
deployment.

## How money works (the important part)

- Every shared expense stores **who paid** and a **split** (one share per member):
  - **50/50** — the payer is owed the other person's share.
  - **Own share** — counts toward household spending and the payer's contribution,
    creates no debt (use this when each of you pays your own R4,400 rent).
  - **Custom** — any shares that add up to the amount.
- **Who owes who** = everything you paid − everything that was your share, across all
  shared expenses and settlements. **Record a settlement** (Dashboard) when one of you
  pays the other back.
- **Personal** expenses are tracked but never counted in household totals.
- **Business** income/expenses live in their own scope; **Allocate funds** moves
  business money into household funding, tracked separately from personal contributions.
- Statement imports (Joint account, CSV) are **never** auto-booked — each row waits for
  your review and approval.

## Structure

- `supabase/schema.sql` — tables, RLS policies, storage bucket, seed categories
- `lib/money.ts` — all financial calculations (pure functions over transactions)
- `lib/data.ts` — mutations + audit logging; `lib/store.tsx` — session/household context
- `components/` — UI primitives, charts, shell/nav, the shared transaction form
- `app/(app)/` — one route per section (dashboard, transactions, rent, groceries,
  grocery-list, meals, planner, electricity, transport, business, joint, reports,
  activity, settings)

Scaling later: households/members are already relational (not hard-coded to two
people), categories are per-household rows, and statements/imports have their own
tables — adding members, accounts or new sections does not require restructuring.
