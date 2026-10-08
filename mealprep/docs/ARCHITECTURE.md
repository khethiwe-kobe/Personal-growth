# MealPrep OS — Architecture & Design

This document is the pre-build analysis required by the brief: requirements
analysis, gaps, architecture, data model, roles, journeys, UI structure,
security/privacy, nutrition safety and the phased roadmap.

## 1. Requirements analysis (what the brief actually asks for)

The brief describes **one connected operating system** for a personalised
meal-prep business. The single most important sentence is the last one:

> CLIENT DATA → NUTRITION ANALYSIS → PERSONALISATION → MEAL PLAN → RECIPES →
> GROCERY LIST → INVENTORY → PRODUCTION → PACKAGING → DELIVERY → FEEDBACK →
> RETENTION → REVENUE → BUSINESS INTELLIGENCE

Every module therefore has to *read from and write to the same records*:

| Upstream record | Derived downstream |
|---|---|
| Client health profile | Nutrition targets, warnings, professional-review flag |
| Nutrition targets + preferences + allergies | Meal recommendations (scored, with reasons) |
| Recommendations | Weekly meal plan (per-day totals, gap detection) |
| Meal plan (approved) | Order → order items (one per meal slot) |
| Order items | Grocery requirements (recipe ingredients × portions × waste) |
| Grocery requirements − inventory | Purchase list, supplier comparison, purchase orders |
| Paid order | Production batches (grouped by meal), status pipeline |
| Production (ready) | Labels (nutrition, allergens, QR), deliveries |
| Delivered | Feedback request, progress tracking, renewal |
| Payments, expenses, recipe costs | Finance dashboard, pricing engine, analytics |
| All of the above | AI business assistant (answers from real data) |

## 2. Missing / implicit requirements the brief did not state

Identified while analysing; all are designed in (most implemented):

1. **Units & ingredient normalisation.** Grocery aggregation is impossible
   unless every recipe ingredient resolves to a canonical ingredient with a
   base unit (g / ml / each). Recipes may use "1 cup" but the system stores
   grams. → `ingredients.base_unit`, `recipe_ingredients.quantity` in base unit.
2. **Nutrition is derived, not typed.** Meal nutrition must be computed from
   ingredient nutrition per 100 g × quantity ÷ servings, otherwise labels drift
   from recipes. Manual overrides are allowed but flagged.
3. **Cost is derived too.** Cost per serving = Σ(ingredient qty × latest
   supplier price) + packaging + labour share. Price changes must propagate.
4. **Meal-plan approval is a state**, not a button: draft → proposed →
   approved → ordered. Clients approve from the portal.
5. **Order ↔ production are many-to-many.** 35 chicken bowls for 12 clients is
   one production batch; one order spans many batches. → `production_batches`
   + `production_items`.
6. **Inventory needs lots (batches)** for FIFO, expiry and traceability, and a
   ledger of transactions (purchase, consume, waste, adjust).
7. **Multi-person orders.** "Number of people being served" means an order can
   carry a portion multiplier (family packages).
8. **Audit log + consent are first-class** because health data is special
   personal information under POPIA.
9. **Idempotent automation.** Events (order.paid, delivery.completed, …) go
   through one event bus so webhooks/integrations can be attached later.
10. **Tenant boundary.** Everything hangs off `business_settings`; a future
    multi-location/multi-tenant version adds `business_id` to every table.
11. **Time windows & capacity.** Kitchen capacity (meals/day) is needed to
    stop the planner over-promising delivery dates.
12. **Client self-service vs staff action.** Portal actions (approve plan,
    skip week, pause subscription, submit feedback, log progress) must be
    constrained to the client's own rows via the role system.
13. **Professional review workflow.** A flag is not enough: a reviewer must
    be able to record *who* reviewed, *when* and *what the outcome was*.
14. **Disclaimers are content, not afterthoughts.** Every nutrition surface
    renders the disclaimer component.

## 3. Application architecture

```
Next.js 16 (App Router, React 19, Server Components + Server Actions)
├── app/            routes (admin shell, client portal, public onboarding, QR meal page, CSV/export APIs)
├── components/     UI kit (cards, stat tiles, charts, kanban, tables, badges, modal forms)
├── lib/
│   ├── db.ts       SQLite (better-sqlite3) + idempotent migrations
│   ├── auth.ts     scrypt passwords, opaque sessions, RBAC permission matrix
│   ├── repo/*.ts   data access per aggregate (clients, meals, orders, inventory, …)
│   ├── nutrition.ts    Mifflin-St Jeor, activity multipliers, goal-adjusted ranges, warnings
│   ├── recommend.ts    scoring engine with explain-why reasons
│   ├── planner.ts      weekly plan generation + gap detection + adjustments
│   ├── grocery.ts      plan/order → requirements → purchase list (waste %, stock netting)
│   ├── costing.ts      recipe scaling, ingredient cost roll-up, pricing scenarios
│   ├── finance.ts      revenue/COGS/profit, AOV, CAC, CLV, break-even
│   ├── analytics.ts    growth, retention, popularity, waste
│   ├── assistant.ts    intent-matching business assistant over live data
│   ├── automation.ts   event bus → handlers (+ outbound webhook)
│   ├── comms.ts        message templates + channel adapters (WhatsApp/Email/SMS stubs)
│   ├── labels.ts       label payload + QR token
│   └── audit.ts        audit log writer
├── scripts/seed.ts     realistic demo business
└── tests/              node:test unit tests for every engine
```

**Why SQLite now, Postgres later.** The repo's sibling apps use SQLite and it
is zero-ops for a 10–100 client business. The schema uses only portable SQL
(integer PKs, ISO-8601 text dates, JSON in TEXT) so a move to Postgres (e.g.
Supabase) is a connection-string change plus `lib/db.ts`. All data access is
behind `lib/repo`, so the swap does not touch UI code.

**Scaling narrative.**

| Clients | What changes |
|---|---|
| 10 | Single Next.js process, SQLite, one admin. Everything in this repo works as-is. |
| 100 | Same code. Postgres instead of SQLite; background jobs (`automation.ts` queue) moved to a worker; object storage for photos; WhatsApp/email adapters wired to real providers. |
| 1,000 | Multi-tenant (`business_id`), read replicas for analytics, production split by kitchen/location (`locations` table is already in the schema), route optimisation service, data warehouse export for BI. Domain modules are already separated so they can become services. |

## 4. Database schema

See `lib/schema.sql` (authoritative) and `docs/DATABASE.md` for the ER summary.
Core principle: no duplicated facts. Nutrition and cost live on ingredients;
meals derive them. Client targets are computed from the health profile and
cached with a `computed_at` so a profile change invalidates them.

## 5. Roles and permissions

| Role | Access |
|---|---|
| admin | everything |
| planner | clients, health profiles, nutrition, recommendations, meal plans, meals, recipes |
| kitchen | production, recipes, inventory, grocery |
| packaging | labels, orders (read), packaging status |
| delivery | deliveries, routes, order delivery info, client addresses |
| accounting | payments, expenses, invoices, finance, pricing |
| client | only own profile, plans, orders, deliveries, subscription, progress, feedback |

Permissions are expressed as `resource:action` strings in `lib/auth.ts`
(`PERMISSIONS`), checked in server actions and layouts. Clients are a
separate principal: a `users` row with `role='client'` linked to `clients.user_id`.

## 6. Main user journeys

1. **Owner opens the day**: Dashboard → alerts (low stock, expiring lots,
   unpaid orders, at-risk clients) → Production board → Deliveries.
2. **New client**: `/onboard` (10 steps) → profile + health profile + consent →
   nutrition summary → recommendations → professional-review flag (if any) →
   planner builds weekly plan → client approves in portal → order → payment.
3. **Weekly ops cycle**: Approved plans/orders for the week → Grocery list
   (net of stock) → Supplier comparison → Purchase → Inventory lots →
   Production batches → Labels → Delivery route → Proof of delivery →
   Feedback request → Progress check-in → Renewal.
4. **Client**: portal dashboard → this week's meals → approve plan → track
   progress → rate meals → manage subscription (skip/pause).
5. **Finance**: payments, expenses, pricing scenarios, break-even, monthly
   report export.

## 7. UI structure

Admin shell with grouped sidebar: *Overview* (Dashboard, Workflow, Assistant),
*Clients* (Clients, Onboarding, Feedback), *Nutrition* (Meals, Ingredients,
Meal plans, Recommendations), *Operations* (Orders, Subscriptions, Grocery,
Inventory, Suppliers, Production, Packaging/Labels, Deliveries), *Finance*
(Payments, Expenses, Pricing, Finance, Analytics, Reports), *Business*
(Business plan, Startup costs, Break-even, Marketing, Brand, Compliance,
Automations, Settings, Audit log). Client portal is a separate, calmer shell.

Design language: warm off-white surfaces, charcoal text, one accent (deep
terracotta) for actions, category colour coding for meal types, no "green leaf"
clichés. See `docs/BRAND.md`.

## 8. Security & privacy requirements

- scrypt password hashing, opaque 256-bit session tokens, hash-only storage.
- Role-based permission matrix enforced server-side (actions + layouts).
- Client rows are reachable by a client user only through `requireClient()`.
- Audit log on every create/update/delete of sensitive records.
- Consent recorded with version, timestamp and IP-less (privacy) fingerprint.
- Data export (JSON) and deletion (anonymise + cascade) per client.
- Health fields are stored as "special personal information" and surfaced
  with POPIA notices. Encryption at rest is a deployment concern (SQLCipher /
  Postgres TDE); application-level field encryption helper is in `lib/crypto.ts`.
- Backups: documented in `docs/SECURITY-PRIVACY.md`.

## 9. Health / nutrition safety

- Calculations use Mifflin-St Jeor + activity multipliers; goal adjustments are
  capped (max −20 % / +15 %); absolute floor of 1,200 kcal (female) / 1,500
  kcal (male) before a professional-review flag.
- Flags: BMI < 18.5 or ≥ 35, age < 18, pregnancy/breastfeeding, medical
  condition, eating-disorder history, medically restricted diet, severe
  allergies. Flag → "Professional review recommended before personalised meal
  recommendations are provided." and recommendations are marked *preliminary*.
- Blood type is stored and shown as *informational only*; it never influences
  any calculation or recommendation.
- Every nutrition page renders the disclaimer: estimates, not medical advice.

## 10. Roadmap

See `docs/ROADMAP.md`. Phases 1–4 are implemented in this codebase as a
foundation; Phase 5 items are designed (schema, events, integration points)
and listed with what remains.
