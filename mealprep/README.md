# MealPrep OS

A complete operating system for a premium, personalised meal-prep business:
CRM, nutrition analysis, recommendation engine, weekly planner, recipes,
grocery purchasing, inventory, suppliers, kitchen production, labels with QR
codes, deliveries, subscriptions, payments, pricing, finance, analytics,
marketing, business planning, compliance, automation and a client portal —
all reading and writing the same records.

```
CLIENT DATA → NUTRITION ANALYSIS → PERSONALISATION → MEAL PLAN → RECIPES → GROCERY LIST
→ INVENTORY → PRODUCTION → PACKAGING → DELIVERY → FEEDBACK → RETENTION → REVENUE → INTELLIGENCE
```

## Run it

```bash
cd mealprep
npm install
npm run seed      # realistic demo business (14 clients, 26 meals, 3 months of history)
npm run dev       # http://localhost:3200
```

| Login | Password | Lands on |
|---|---|---|
| owner@demo.local (admin) | `admin-demo` | Owner dashboard |
| planner@demo.local | `planner-demo` | Clients, nutrition, plans |
| kitchen@demo.local | `kitchen-demo` | Production, inventory |
| packaging@demo.local | `packaging-demo` | Labels |
| driver@demo.local | `delivery-demo` | Deliveries |
| accounts@demo.local | `accounting-demo` | Finance |
| thandiwe@client.local (any seeded client) | `client-demo` | Client portal |

`npm run seed -- --force` wipes and reseeds. `npm test` runs the engine tests.
`npm run build && npm start` for production (set `MEALPREP_SESSION_SECRET`,
`MEALPREP_PUBLIC_URL` for QR links, optional `MEALPREP_WEBHOOK_URL`).

New clients self-onboard at `/onboard` (10 steps, consent, portal password);
staff can run the same flow for a client.

## What's inside

| Area | Highlights |
|---|---|
| **Dashboard** | Today's orders, meals to prepare / in progress / ready, deliveries, pending payments, new/active/at-risk clients, revenue (today/week/month), food & packaging cost, estimated profit, revenue chart, popular meals, cost structure, satisfaction, renewals, alerts |
| **Clients / CRM** | Full profile (personal, health, preferences, allergies, goals), nutrition snapshot, subscriptions, plans & orders, progress charts, timeline, consent record, JSON export, anonymise/delete |
| **Nutrition analysis** | Mifflin-St Jeor + activity multipliers, goal-adjusted calorie range (capped deficits, safety floors), protein/carb/fat/fibre/water, meal distribution, safety flags → "Professional review recommended…", review sign-off record. Blood type stored as informational only |
| **Recommendation engine** | Scores every meal per slot against targets, allergies (hard exclusion), intolerances, pattern, likes/dislikes, cuisine, budget, stock, season, ratings — with reasons and cautions; substitutions |
| **Meal database & recipes** | Nutrition and allergens derived from ingredients; true cost (ingredients + packaging + labour + overhead); margin; pricing scenarios; recipe scaling (4 → 40) with purchasing quantities |
| **Weekly planner** | Generates Mon–Sun × breakfast/lunch/snack/dinner, rotates for variety, audits each day (energy, protein, fibre, carbs, fat) and suggests adjustments; editable grid with portion multipliers; client approval; printable; CSV |
| **Grocery list** | All orders in a window → ingredients grouped by category, with waste %, stock netting, purchase quantity, cost estimate, recommended supplier; one-click purchase orders |
| **Inventory** | Lots with batch, expiry, supplier, location; FIFO consumption when cooking starts; waste & adjustments; ledger; low-stock and expiry alerts; packaging stock |
| **Suppliers** | Profiles, prices per ingredient, price history, weighted comparison (price/reliability/quality), purchase orders → lots |
| **Production** | Kanban by status per day, batches merged across orders, ingredient requirements vs stock, staff assignment, QC notes, capacity planning |
| **Packaging & labels** | Printable labels: client, meal n of N, dates, nutrition, ingredients, allergens, storage, reheating, QR → client meal page |
| **Deliveries** | Daily route sheet, driver assignment, route ordering, windows, proof of delivery, failed deliveries; completion triggers feedback request |
| **Orders & subscriptions** | Board + table, statuses end-to-end, invoices, payments (→ production queue), packages (editable), weekly/biweekly/monthly subscriptions with skip/pause/cancel/renew |
| **Finance** | Revenue, COGS, expenses by category, gross/net profit, AOV, CAC, CLV, repeat rate, food-cost %, profitability per meal, monthly series; pricing engine with configurable assumptions and margin scenarios; break-even calculator; startup cost planner |
| **Analytics** | Growth, retention cohorts, orders/meals per week, satisfaction trend, popular & profitable meals, waste %, demand forecast; filters by date/client/meal/package/subscription/staff |
| **Assistant** | Answers business questions from live data ("How much chicken do I need next week?", "Which supplier has the cheapest…", "Which clients haven't ordered…") |
| **Automation** | Event bus with handlers (welcome, plan ready, order confirmation, payment reminder, preparation started, delivery reminder, delivered, feedback request, renewal, low stock, expiry, pricing review), message queue with channel adapters, outbound webhook for Make/Zapier/n8n |
| **Business** | Plan, segments, value propositions, revenue streams, scaling narrative, 50+ brand names, taglines, identity, campaigns, compliance checklist (SA food safety + POPIA), settings, staff & roles, audit log |
| **Client portal** | Home, plan approval, meals, nutrition, progress check-ins, orders, deliveries, subscription self-service, payments, grocery, recipes, feedback, profile |

## Documentation

- `docs/ARCHITECTURE.md` — requirements analysis, gaps, architecture, scaling 10 → 100 → 1,000 clients
- `docs/DATABASE.md` — entity map, single-source rules, status machines, Postgres migration
- `docs/SECURITY-PRIVACY.md` — POPIA controls and operational checklist
- `docs/BRAND.md` — identity summary
- `docs/ROADMAP.md` — phases and what to do next

## Health & safety stance

Nutrition figures are estimates from recognised equations and ingredient data.
The app never diagnoses, never prescribes, never applies aggressive deficits,
and flags under-18s, pregnancy, medical conditions, eating-disorder history,
restricted diets, severe allergies and BMI extremes for professional review
before personalised recommendations are presented. Blood type is never an input.
