# Database design

Authoritative DDL: `lib/schema.ts` (exported as a string so serverless bundles include it) (SQLite dialect, portable to Postgres). Every
table the brief suggested exists, plus the ones needed to keep facts single-sourced.

## Entity map

```
users ──< sessions
users ──< notifications, audit_log
users 1─1 clients (clients.user_id, role = client)

clients ──< client_health_profiles (1:1)   special personal information
        ──< client_preferences (1:1)
        ──< client_goals
        ──< client_allergies
        ──< client_measurements            weight history
        ──< client_nutrition_targets (1:1) derived cache (+ flags, review flag)
        ──< client_consents
        ──< professional_reviews
        ──< client_progress
        ──< communications
        ──< meal_plans ──< meal_plan_items ──> meals
        ──< orders ──< order_items ──> meals
        ──< subscriptions ──< subscription_events
        ──< payments
        ──< deliveries ──> delivery_routes
        ──< feedback ──> meals
        ──> corporate_accounts, locations

ingredients ──< recipe_ingredients >── meals 1─1 recipes
ingredients ──< supplier_products >── suppliers ──< supplier_price_history
ingredients ──< inventory_lots ──< inventory_transactions
suppliers ──< purchase_orders ──< purchase_order_lines

orders/order_items ──< production_items >── production_batches ──> meals
order_items 1─1 meal_labels (QR token)

business_settings (key/value), packages, packaging_items, expenses,
marketing_campaigns, startup_cost_items, compliance_items, automation_events
```

## Single-source rules (no duplicated data)

| Fact | Lives in | Derived where |
|---|---|---|
| Nutrition per 100 g | `ingredients` | meal nutrition = Σ(recipe qty × per-100) ÷ servings (`lib/costing.ts`) |
| Ingredient price | `supplier_products` (best active price) → fallback `ingredients.default_cost_per_unit` | meal cost, grocery estimates, PO lines |
| Client targets | computed from `client_health_profiles` + `client_goals` + `client_preferences` | cached in `client_nutrition_targets` with `computed_at`; recomputed on every profile write |
| Order price/cost | snapshotted on `order_items` at order time (`unit_price_zar`, `unit_cost_zar`) | finance uses the snapshot so later price changes don't rewrite history |
| Stock on hand | Σ `inventory_lots.quantity_remaining` | ledger in `inventory_transactions` |
| Production demand | `production_batches` built from paid `order_items` via `production_items` | the day before `orders.delivery_date` |

## Status machines

- **orders**: inquiry → quote_sent → awaiting_payment → paid → plan_created → shopping → preparing → packaging → ready → out_for_delivery → delivered → completed (cancelled from any). Production and delivery update the order automatically; staff can override.
- **production_batches**: not_started → preparing → cooking (consumes stock FIFO) → portioning → packaging → quality_check → ready (labels generated) → delivered.
- **deliveries**: pending → assigned → out_for_delivery → delivered | failed.
- **meal_plans**: draft → proposed → approved → ordered | archived.
- **subscriptions**: active ⇄ paused → cancelled | expired.

## Moving to Postgres

1. Replace `INTEGER PRIMARY KEY AUTOINCREMENT` with `BIGSERIAL`, `datetime('now')` with `now()`, `date('now', '-7 days')` with interval arithmetic (all such expressions are in `lib/repo/*` and `lib/finance.ts`).
2. `json_extract` → `->>`.
3. Swap `better-sqlite3` for `pg` in `lib/db.ts`; the repo layer's prepared statements are plain SQL strings.
4. Add `business_id` to every table for multi-tenant SaaS.
