# Roadmap

| Phase | Scope | Status in this codebase |
|---|---|---|
| 1 — Core | Auth, RBAC, dashboard, clients, client profiles, onboarding, meal database, recipes, meal plans, orders | Implemented |
| 2 — Operations | Inventory (lots, FIFO, expiry, waste), grocery lists, suppliers & price comparison, kitchen production board, packaging & labels (QR), deliveries & routes | Implemented |
| 3 — Finance | Pricing engine (scenarios, packages), payments, expenses, profitability, subscriptions, break-even, startup costs | Implemented |
| 4 — Intelligence | Nutrition engine, recommendation engine with reasons, weekly planner with gap detection, business assistant over live data, simple demand/inventory forecasting | Implemented (forecasting = moving-average baseline) |
| 5 — Scale | Automation event bus + outbound webhook, client portal, mobile-responsive layout, analytics with filters, corporate accounts, multi-location | Event bus, portal, responsive layout, analytics and `locations`/`corporate_accounts` tables implemented; route optimisation, real messaging providers, payment gateways and multi-tenant isolation are integration work |

## What to do next (in order)

1. Deploy with Postgres + managed backups; set `MEALPREP_SESSION_SECRET`.
2. Wire `lib/comms.ts` adapters to WhatsApp Business API, an email provider
   and an SMS gateway (each adapter is a single function).
3. Connect PayFast/Stripe webhooks to `recordPayment` (the automation event
   `payment.received` already drives the production queue).
4. Replace the rule-based assistant's answer formatter with an LLM call that
   receives the same structured data (the data-retrieval layer is reusable).
5. Add route optimisation (Google Maps Distance Matrix) to `delivery_routes`.
