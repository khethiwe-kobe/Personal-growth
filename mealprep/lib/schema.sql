-- MealPrep OS relational schema (SQLite dialect, Postgres-portable).
-- Facts live once: nutrition & cost on ingredients, targets derived from health
-- profiles, orders derived from plans, production derived from orders.

CREATE TABLE IF NOT EXISTS business_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS locations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  address    TEXT NOT NULL DEFAULT '',
  capacity_meals_per_day INTEGER NOT NULL DEFAULT 200,
  is_active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'client', -- admin|planner|kitchen|packaging|delivery|accounting|client
  phone         TEXT NOT NULL DEFAULT '',
  is_active     INTEGER NOT NULL DEFAULT 1,
  is_demo       INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS corporate_accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  contact_name  TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  billing_terms TEXT NOT NULL DEFAULT 'prepaid',
  discount_pct  REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  corporate_account_id INTEGER REFERENCES corporate_accounts(id) ON DELETE SET NULL,
  location_id        INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  email              TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  date_of_birth      TEXT,
  gender             TEXT NOT NULL DEFAULT 'unspecified', -- female|male|other|unspecified
  address            TEXT NOT NULL DEFAULT '',
  delivery_address   TEXT NOT NULL DEFAULT '',
  delivery_notes     TEXT NOT NULL DEFAULT '',
  emergency_contact  TEXT NOT NULL DEFAULT '',
  photo_blob         BLOB,
  photo_mime         TEXT,
  status             TEXT NOT NULL DEFAULT 'lead', -- lead|onboarding|active|paused|churned
  source             TEXT NOT NULL DEFAULT '',    -- marketing channel
  notes              TEXT NOT NULL DEFAULT '',
  registered_at      TEXT NOT NULL DEFAULT (datetime('now')),
  anonymised_at      TEXT
);

-- Special personal information (POPIA). One current row per client; history
-- of body measurements lives in client_measurements.
CREATE TABLE IF NOT EXISTS client_health_profiles (
  client_id            INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  height_cm            REAL,
  weight_kg            REAL,
  target_weight_kg     REAL,
  activity_level       TEXT NOT NULL DEFAULT 'moderate', -- sedentary|light|moderate|active|very_active
  fitness_level        TEXT NOT NULL DEFAULT 'beginner',
  blood_type           TEXT NOT NULL DEFAULT '',          -- informational only
  training_schedule    TEXT NOT NULL DEFAULT '',
  lifestyle            TEXT NOT NULL DEFAULT '',
  sleep_hours          REAL,
  water_litres         REAL,
  stress_level         TEXT NOT NULL DEFAULT '',
  is_pregnant          INTEGER NOT NULL DEFAULT 0,
  is_breastfeeding     INTEGER NOT NULL DEFAULT 0,
  medical_conditions   TEXT NOT NULL DEFAULT '',
  medications          TEXT NOT NULL DEFAULT '',
  eating_disorder_history INTEGER NOT NULL DEFAULT 0,
  medically_restricted_diet TEXT NOT NULL DEFAULT '',
  other_notes          TEXT NOT NULL DEFAULT '',
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_goals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  goal_type   TEXT NOT NULL, -- weight_management|muscle_gain|healthy_eating|sports_performance|convenience|balanced|high_protein|vegetarian|vegan|lower_carb|custom
  description TEXT NOT NULL DEFAULT '',
  target_value REAL,
  target_unit TEXT NOT NULL DEFAULT '',
  target_date TEXT,
  is_primary  INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'active', -- active|achieved|paused
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_preferences (
  client_id            INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  dietary_pattern      TEXT NOT NULL DEFAULT 'omnivore', -- omnivore|pescatarian|vegetarian|vegan|halal|kosher|other
  dietary_tags         TEXT NOT NULL DEFAULT '[]',       -- JSON: ["high_protein","lower_carb","gluten_free",...]
  cuisines             TEXT NOT NULL DEFAULT '[]',       -- JSON array
  liked_foods          TEXT NOT NULL DEFAULT '[]',
  disliked_foods       TEXT NOT NULL DEFAULT '[]',
  meals_per_day        INTEGER NOT NULL DEFAULT 3,
  include_snacks       INTEGER NOT NULL DEFAULT 1,
  meal_times           TEXT NOT NULL DEFAULT '{}',       -- JSON {breakfast:"07:00",...}
  people_served        INTEGER NOT NULL DEFAULT 1,
  cooking_preference   TEXT NOT NULL DEFAULT 'ready_to_heat', -- ready_to_heat|some_assembly|cook_at_home
  spice_level          TEXT NOT NULL DEFAULT 'medium',
  budget_per_meal_zar  REAL,
  budget_per_week_zar  REAL,
  preferred_delivery_days TEXT NOT NULL DEFAULT '[]',
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_allergies (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL DEFAULT 'allergy', -- allergy|intolerance|avoid|medical
  allergen  TEXT NOT NULL,                  -- canonical allergen key or free text
  severity  TEXT NOT NULL DEFAULT 'moderate', -- mild|moderate|severe
  notes     TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS client_measurements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  measured_at TEXT NOT NULL,
  weight_kg   REAL,
  waist_cm    REAL,
  hips_cm     REAL,
  chest_cm    REAL,
  body_fat_pct REAL,
  notes       TEXT NOT NULL DEFAULT ''
);

-- Derived cache of nutrition targets (recomputed when the profile changes).
CREATE TABLE IF NOT EXISTS client_nutrition_targets (
  client_id      INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  bmr            REAL, tdee REAL,
  calories_min   REAL, calories_target REAL, calories_max REAL,
  protein_g      REAL, carbs_min_g REAL, carbs_max_g REAL,
  fat_min_g      REAL, fat_max_g REAL, fibre_g REAL, water_ml REAL,
  method         TEXT NOT NULL DEFAULT 'mifflin_st_jeor',
  overrides_json TEXT NOT NULL DEFAULT '{}',
  flags_json     TEXT NOT NULL DEFAULT '[]',
  requires_professional_review INTEGER NOT NULL DEFAULT 0,
  computed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS professional_reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_role TEXT NOT NULL DEFAULT '', -- registered dietitian|doctor|other
  outcome      TEXT NOT NULL DEFAULT 'pending', -- pending|approved|approved_with_limits|declined
  notes        TEXT NOT NULL DEFAULT '',
  reviewed_at  TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_consents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- data_processing|health_data|marketing|terms
  version     TEXT NOT NULL,
  granted     INTEGER NOT NULL DEFAULT 1,
  granted_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------- catalogue
CREATE TABLE IF NOT EXISTS ingredients (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE COLLATE NOCASE,
  category       TEXT NOT NULL, -- meat|poultry|fish|vegetables|fruit|dairy|grains|legumes|pantry|herbs_spices|sauces|packaging|other
  base_unit      TEXT NOT NULL DEFAULT 'g', -- g|ml|each
  kcal_per_100   REAL NOT NULL DEFAULT 0,
  protein_per_100 REAL NOT NULL DEFAULT 0,
  carbs_per_100  REAL NOT NULL DEFAULT 0,
  fat_per_100    REAL NOT NULL DEFAULT 0,
  fibre_per_100  REAL NOT NULL DEFAULT 0,
  sodium_mg_per_100 REAL NOT NULL DEFAULT 0,
  sugar_per_100  REAL NOT NULL DEFAULT 0,
  allergens      TEXT NOT NULL DEFAULT '[]', -- JSON array of allergen keys
  default_cost_per_unit REAL NOT NULL DEFAULT 0, -- ZAR per base unit (fallback when no supplier price)
  waste_pct      REAL NOT NULL DEFAULT 5,   -- trimming/cooking loss used in purchasing
  seasonal_months TEXT NOT NULL DEFAULT '[]', -- JSON [1..12], empty = all year
  min_stock      REAL NOT NULL DEFAULT 0,
  storage        TEXT NOT NULL DEFAULT 'chilled', -- ambient|chilled|frozen
  is_active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS suppliers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  contact_name  TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL DEFAULT '',
  min_order_zar REAL NOT NULL DEFAULT 0,
  delivery_days TEXT NOT NULL DEFAULT '[]', -- JSON ["mon","thu"]
  lead_time_days INTEGER NOT NULL DEFAULT 1,
  reliability   INTEGER NOT NULL DEFAULT 4, -- 1-5
  quality       INTEGER NOT NULL DEFAULT 4, -- 1-5
  notes         TEXT NOT NULL DEFAULT '',
  is_active     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS supplier_products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id    INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  ingredient_id  INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  price_per_unit REAL NOT NULL, -- ZAR per ingredient base unit
  pack_size      REAL NOT NULL DEFAULT 1000, -- base units per pack
  product_code   TEXT NOT NULL DEFAULT '',
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (supplier_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS supplier_price_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_product_id INTEGER NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  price_per_unit REAL NOT NULL,
  recorded_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL, -- breakfast|lunch|dinner|snack|dessert|drink
  cuisine          TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  servings         INTEGER NOT NULL DEFAULT 4, -- recipe yield
  serving_size_g   REAL NOT NULL DEFAULT 400,
  prep_minutes     INTEGER NOT NULL DEFAULT 15,
  cook_minutes     INTEGER NOT NULL DEFAULT 30,
  cook_temp_c      INTEGER,
  shelf_life_days  INTEGER NOT NULL DEFAULT 4,
  storage          TEXT NOT NULL DEFAULT 'Keep refrigerated at or below 4°C.',
  reheating        TEXT NOT NULL DEFAULT 'Microwave 2–3 min until piping hot (75°C core).',
  food_safety_notes TEXT NOT NULL DEFAULT '',
  dietary_tags     TEXT NOT NULL DEFAULT '[]', -- JSON
  complexity       INTEGER NOT NULL DEFAULT 2, -- 1 easy .. 5 complex
  bulk_friendly    INTEGER NOT NULL DEFAULT 1,
  packaging_cost   REAL NOT NULL DEFAULT 0,    -- ZAR per serving (overrides settings default when > 0)
  labour_minutes_per_serving REAL NOT NULL DEFAULT 4,
  selling_price    REAL NOT NULL DEFAULT 0,
  tier             TEXT NOT NULL DEFAULT 'standard', -- basic|standard|premium
  image_url        TEXT NOT NULL DEFAULT '',
  internal_rating  INTEGER NOT NULL DEFAULT 4,
  nutrition_override TEXT NOT NULL DEFAULT '{}', -- JSON manual per-serving overrides
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipes (
  meal_id      INTEGER PRIMARY KEY REFERENCES meals(id) ON DELETE CASCADE,
  steps_json   TEXT NOT NULL DEFAULT '[]', -- JSON [{title, text, minutes?, temp_c?}]
  portion_note TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  meal_id       INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  quantity      REAL NOT NULL, -- in ingredient base unit, for the recipe's full yield
  note          TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- --------------------------------------------------------------- planning
CREATE TABLE IF NOT EXISTS meal_plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_start    TEXT NOT NULL, -- Monday ISO date
  status        TEXT NOT NULL DEFAULT 'draft', -- draft|proposed|approved|ordered|archived
  goal_type     TEXT NOT NULL DEFAULT '',
  meals_per_day INTEGER NOT NULL DEFAULT 3,
  include_snacks INTEGER NOT NULL DEFAULT 1,
  budget_zar    REAL,
  notes         TEXT NOT NULL DEFAULT '',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id     INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_index   INTEGER NOT NULL, -- 0 = Monday
  slot        TEXT NOT NULL,    -- breakfast|lunch|snack|dinner
  meal_id     INTEGER NOT NULL REFERENCES meals(id),
  portion_multiplier REAL NOT NULL DEFAULT 1,
  reasons_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS packages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  meals_per_week INTEGER NOT NULL,
  price_zar     REAL NOT NULL,
  is_custom     INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  package_id      INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  meals_per_week  INTEGER NOT NULL,
  frequency       TEXT NOT NULL DEFAULT 'weekly', -- weekly|biweekly|monthly
  price_per_cycle REAL NOT NULL,
  start_date      TEXT NOT NULL,
  renewal_date    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active', -- active|paused|cancelled|expired
  meals_remaining INTEGER NOT NULL DEFAULT 0,
  paused_at       TEXT,
  cancelled_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscription_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL, -- renewed|skipped|paused|resumed|cancelled|changed
  week_start      TEXT,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number    TEXT NOT NULL UNIQUE,
  client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  meal_plan_id    INTEGER REFERENCES meal_plans(id) ON DELETE SET NULL,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  package_id      INTEGER REFERENCES packages(id) ON DELETE SET NULL,
  location_id     INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'inquiry', -- inquiry|quote_sent|awaiting_payment|paid|plan_created|shopping|preparing|packaging|ready|out_for_delivery|delivered|completed|cancelled
  delivery_date   TEXT NOT NULL,
  delivery_address TEXT NOT NULL DEFAULT '',
  people_served   INTEGER NOT NULL DEFAULT 1,
  subtotal_zar    REAL NOT NULL DEFAULT 0,
  discount_zar    REAL NOT NULL DEFAULT 0,
  delivery_fee_zar REAL NOT NULL DEFAULT 0,
  total_zar       REAL NOT NULL DEFAULT 0,
  payment_status  TEXT NOT NULL DEFAULT 'unpaid', -- unpaid|partial|paid|refunded
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  meal_id      INTEGER NOT NULL REFERENCES meals(id),
  meal_number  INTEGER NOT NULL, -- "Meal 03 of 14"
  day_index    INTEGER,
  slot         TEXT NOT NULL DEFAULT '',
  quantity     INTEGER NOT NULL DEFAULT 1,
  portion_multiplier REAL NOT NULL DEFAULT 1,
  unit_price_zar REAL NOT NULL DEFAULT 0,
  unit_cost_zar  REAL NOT NULL DEFAULT 0, -- snapshot of true cost at order time
  status       TEXT NOT NULL DEFAULT 'pending' -- pending|in_production|ready|packed|delivered
);

CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_zar  REAL NOT NULL,
  method      TEXT NOT NULL DEFAULT 'eft', -- eft|card|payfast|stripe|cash|other
  reference   TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'completed', -- pending|completed|failed|refunded
  paid_at     TEXT NOT NULL DEFAULT (datetime('now')),
  notes       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category    TEXT NOT NULL, -- food|packaging|labour|delivery|marketing|rent|utilities|software|insurance|licensing|equipment|other
  description TEXT NOT NULL DEFAULT '',
  amount_zar  REAL NOT NULL,
  incurred_at TEXT NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --------------------------------------------------------------- inventory
CREATE TABLE IF NOT EXISTS purchase_orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status      TEXT NOT NULL DEFAULT 'draft', -- draft|sent|received|cancelled
  expected_at TEXT,
  received_at TEXT,
  total_zar   REAL NOT NULL DEFAULT 0,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id     INTEGER NOT NULL REFERENCES ingredients(id),
  quantity          REAL NOT NULL,
  price_per_unit    REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_lots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id   INTEGER NOT NULL REFERENCES ingredients(id),
  supplier_id     INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  batch_number    TEXT NOT NULL DEFAULT '',
  quantity_received REAL NOT NULL,
  quantity_remaining REAL NOT NULL,
  unit_cost       REAL NOT NULL,
  received_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expiry_date     TEXT,
  storage_location TEXT NOT NULL DEFAULT 'Walk-in fridge'
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  lot_id        INTEGER REFERENCES inventory_lots(id) ON DELETE SET NULL,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  type          TEXT NOT NULL, -- purchase|consume|waste|adjust
  quantity      REAL NOT NULL, -- positive in, negative out
  reason        TEXT NOT NULL DEFAULT '',
  reference_type TEXT NOT NULL DEFAULT '', -- production_batch|order|manual
  reference_id  INTEGER,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS packaging_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  unit_cost   REAL NOT NULL,
  stock       INTEGER NOT NULL DEFAULT 0,
  min_stock   INTEGER NOT NULL DEFAULT 50,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL
);

-- --------------------------------------------------------------- production
CREATE TABLE IF NOT EXISTS production_batches (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  production_date  TEXT NOT NULL,
  meal_id          INTEGER NOT NULL REFERENCES meals(id),
  location_id      INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  quantity_required INTEGER NOT NULL,
  quantity_done    INTEGER NOT NULL DEFAULT 0,
  quantity_wasted  INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'not_started', -- not_started|preparing|cooking|portioning|packaging|quality_check|ready|delivered
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  started_at       TEXT,
  completed_at     TEXT,
  qc_notes         TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (production_date, meal_id)
);

CREATE TABLE IF NOT EXISTS production_items (
  batch_id      INTEGER NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  PRIMARY KEY (batch_id, order_item_id)
);

CREATE TABLE IF NOT EXISTS meal_labels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  prepared_on   TEXT NOT NULL,
  best_before   TEXT NOT NULL,
  printed_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------- delivery
CREATE TABLE IF NOT EXISTS delivery_routes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  route_date  TEXT NOT NULL,
  driver_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'planned', -- planned|in_progress|completed
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deliveries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  client_id      INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  route_id       INTEGER REFERENCES delivery_routes(id) ON DELETE SET NULL,
  driver_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  delivery_date  TEXT NOT NULL,
  window_start   TEXT NOT NULL DEFAULT '08:00',
  window_end     TEXT NOT NULL DEFAULT '12:00',
  address        TEXT NOT NULL,
  sequence       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending', -- pending|assigned|out_for_delivery|delivered|failed
  proof_type     TEXT NOT NULL DEFAULT '', -- photo|signature|pin|note
  proof_note     TEXT NOT NULL DEFAULT '',
  proof_blob     BLOB,
  delivered_at   TEXT,
  failure_reason TEXT NOT NULL DEFAULT ''
);

-- --------------------------------------------------------------- engagement
CREATE TABLE IF NOT EXISTS feedback (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  order_id      INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  meal_id       INTEGER REFERENCES meals(id) ON DELETE SET NULL,
  taste         INTEGER, portion INTEGER, presentation INTEGER,
  variety       INTEGER, packaging INTEGER, overall INTEGER,
  comment       TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_progress (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  logged_at     TEXT NOT NULL,
  weight_kg     REAL,
  waist_cm      REAL,
  adherence_pct REAL,
  energy        INTEGER, -- 1-5
  satisfaction  INTEGER, -- 1-5
  water_litres  REAL,
  exercise_minutes INTEGER,
  notes         TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '',
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS communications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL, -- whatsapp|email|sms|in_app
  template    TEXT NOT NULL, -- welcome|assessment_received|...
  subject     TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued', -- queued|sent|failed|skipped
  provider_ref TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at     TEXT
);

CREATE TABLE IF NOT EXISTS automation_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  handled_json TEXT NOT NULL DEFAULT '[]', -- handlers that ran
  webhook_status TEXT NOT NULL DEFAULT 'none', -- none|sent|failed
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER,
  details     TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  channel     TEXT NOT NULL, -- instagram|tiktok|facebook|whatsapp|email|google|referral|other
  start_date  TEXT NOT NULL,
  end_date    TEXT,
  spend_zar   REAL NOT NULL DEFAULT 0,
  leads       INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  orders      INTEGER NOT NULL DEFAULT 0,
  revenue_zar REAL NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active',
  notes       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS startup_cost_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category     TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  estimate_zar REAL NOT NULL DEFAULT 0,
  actual_zar   REAL,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS compliance_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  area        TEXT NOT NULL,
  requirement TEXT NOT NULL,
  guidance    TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'todo', -- todo|in_progress|done|na
  evidence    TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_plan_items_plan ON meal_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ing_meal ON recipe_ingredients(meal_id);
CREATE INDEX IF NOT EXISTS idx_lots_ingredient ON inventory_lots(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(incurred_at);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_feedback_meal ON feedback(meal_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comms_client ON communications(client_id);
