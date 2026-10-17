export type Role =
  | "admin"
  | "planner"
  | "kitchen"
  | "packaging"
  | "delivery"
  | "accounting"
  | "client";

export const ROLES: Role[] = [
  "admin",
  "planner",
  "kitchen",
  "packaging",
  "delivery",
  "accounting",
  "client",
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  planner: "Nutrition / Meal planner",
  kitchen: "Kitchen staff",
  packaging: "Packaging staff",
  delivery: "Delivery staff",
  accounting: "Accounting",
  client: "Client",
};

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Gender = "female" | "male" | "other" | "unspecified";

export type GoalType =
  | "weight_management"
  | "muscle_gain"
  | "healthy_eating"
  | "sports_performance"
  | "convenience"
  | "balanced"
  | "high_protein"
  | "vegetarian"
  | "vegan"
  | "lower_carb"
  | "custom";

export const GOAL_LABELS: Record<GoalType, string> = {
  weight_management: "Weight management",
  muscle_gain: "Muscle gain",
  healthy_eating: "General healthy eating",
  sports_performance: "Sports performance",
  convenience: "Convenience",
  balanced: "Balanced nutrition",
  high_protein: "High-protein",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  lower_carb: "Lower-carbohydrate preference",
  custom: "Custom goal",
};

export type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "dessert" | "drink";
export const MEAL_CATEGORIES: MealCategory[] = ["breakfast", "lunch", "dinner", "snack", "dessert", "drink"];
export type Slot = "breakfast" | "lunch" | "snack" | "dinner";
export const SLOTS: Slot[] = ["breakfast", "lunch", "snack", "dinner"];
export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type IngredientCategory =
  | "meat" | "poultry" | "fish" | "vegetables" | "fruit" | "dairy" | "grains"
  | "legumes" | "pantry" | "herbs_spices" | "sauces" | "packaging" | "other";
export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  "meat", "poultry", "fish", "vegetables", "fruit", "dairy", "grains",
  "legumes", "pantry", "herbs_spices", "sauces", "packaging", "other",
];
export const INGREDIENT_CATEGORY_LABELS: Record<IngredientCategory, string> = {
  meat: "Meat", poultry: "Poultry", fish: "Fish & seafood", vegetables: "Vegetables",
  fruit: "Fruit", dairy: "Dairy & eggs", grains: "Grains", legumes: "Legumes",
  pantry: "Pantry", herbs_spices: "Herbs & spices", sauces: "Sauces & condiments",
  packaging: "Packaging", other: "Other",
};

/** Canonical allergen keys (aligned with common labelling requirements). */
export const ALLERGENS = [
  "gluten", "crustaceans", "eggs", "fish", "peanuts", "soy", "milk", "tree_nuts",
  "celery", "mustard", "sesame", "sulphites", "lupin", "molluscs",
] as const;
export type Allergen = (typeof ALLERGENS)[number];
export const ALLERGEN_LABELS: Record<string, string> = {
  gluten: "Gluten", crustaceans: "Crustaceans", eggs: "Eggs", fish: "Fish",
  peanuts: "Peanuts", soy: "Soy", milk: "Milk", tree_nuts: "Tree nuts", celery: "Celery",
  mustard: "Mustard", sesame: "Sesame", sulphites: "Sulphites", lupin: "Lupin", molluscs: "Molluscs",
};

export const DIETARY_TAGS = [
  "high_protein", "lower_carb", "gluten_free", "dairy_free", "vegetarian", "vegan",
  "pescatarian", "halal", "low_sodium", "nut_free", "kid_friendly", "low_fodmap",
] as const;

export const ORDER_STATUSES = [
  "inquiry", "quote_sent", "awaiting_payment", "paid", "plan_created", "shopping",
  "preparing", "packaging", "ready", "out_for_delivery", "delivered", "completed", "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRODUCTION_STATUSES = [
  "not_started", "preparing", "cooking", "portioning", "packaging", "quality_check", "ready", "delivered",
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const DELIVERY_STATUSES = ["pending", "assigned", "out_for_delivery", "delivered", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type Nutrition = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  sodium_mg: number;
  sugar: number;
};
export const ZERO_NUTRITION: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sodium_mg: 0, sugar: 0 };

// --- Row types (mirror schema.sql) ---------------------------------------
export type UserRow = {
  id: number; email: string; password_hash: string; name: string; role: Role;
  phone: string; is_active: number; is_demo: number; last_login_at: string | null; created_at: string;
};

export type ClientRow = {
  id: number; user_id: number | null; corporate_account_id: number | null; location_id: number | null;
  first_name: string; last_name: string; email: string; phone: string; date_of_birth: string | null;
  gender: Gender; address: string; delivery_address: string; delivery_notes: string;
  emergency_contact: string; photo_mime: string | null; status: string; source: string; notes: string;
  registered_at: string; anonymised_at: string | null;
};

export type HealthProfileRow = {
  client_id: number; height_cm: number | null; weight_kg: number | null; target_weight_kg: number | null;
  activity_level: ActivityLevel; fitness_level: string; blood_type: string; training_schedule: string;
  lifestyle: string; sleep_hours: number | null; water_litres: number | null; stress_level: string;
  is_pregnant: number; is_breastfeeding: number; medical_conditions: string; medications: string;
  eating_disorder_history: number; medically_restricted_diet: string; other_notes: string; updated_at: string;
};

export type PreferencesRow = {
  client_id: number; dietary_pattern: string; dietary_tags: string; cuisines: string; liked_foods: string;
  disliked_foods: string; meals_per_day: number; include_snacks: number; meal_times: string;
  people_served: number; cooking_preference: string; spice_level: string; budget_per_meal_zar: number | null;
  budget_per_week_zar: number | null; preferred_delivery_days: string; updated_at: string;
};

export type AllergyRow = { id: number; client_id: number; kind: string; allergen: string; severity: string; notes: string };

export type GoalRow = {
  id: number; client_id: number; goal_type: GoalType; description: string; target_value: number | null;
  target_unit: string; target_date: string | null; is_primary: number; status: string; created_at: string;
};

export type TargetsRow = {
  client_id: number; bmr: number | null; tdee: number | null; calories_min: number | null;
  calories_target: number | null; calories_max: number | null; protein_g: number | null;
  carbs_min_g: number | null; carbs_max_g: number | null; fat_min_g: number | null; fat_max_g: number | null;
  fibre_g: number | null; water_ml: number | null; method: string; overrides_json: string; flags_json: string;
  requires_professional_review: number; computed_at: string;
};

export type IngredientRow = {
  id: number; name: string; category: IngredientCategory; base_unit: "g" | "ml" | "each";
  kcal_per_100: number; protein_per_100: number; carbs_per_100: number; fat_per_100: number;
  fibre_per_100: number; sodium_mg_per_100: number; sugar_per_100: number; allergens: string;
  default_cost_per_unit: number; waste_pct: number; seasonal_months: string; min_stock: number;
  storage: string; is_active: number;
};

export type MealRow = {
  id: number; name: string; category: MealCategory; cuisine: string; description: string; servings: number;
  serving_size_g: number; prep_minutes: number; cook_minutes: number; cook_temp_c: number | null;
  shelf_life_days: number; storage: string; reheating: string; food_safety_notes: string; dietary_tags: string;
  complexity: number; bulk_friendly: number; packaging_cost: number; labour_minutes_per_serving: number;
  selling_price: number; tier: string; image_url: string; internal_rating: number; nutrition_override: string;
  is_active: number; created_at: string; updated_at: string;
};

export type RecipeIngredientRow = {
  id: number; meal_id: number; ingredient_id: number; quantity: number; note: string; sort_order: number;
};

export type RecipeStep = { title: string; text: string; minutes?: number; temp_c?: number };

export type MealPlanRow = {
  id: number; client_id: number; week_start: string; status: string; goal_type: string; meals_per_day: number;
  include_snacks: number; budget_zar: number | null; notes: string; created_by: number | null;
  approved_at: string | null; created_at: string;
};
export type MealPlanItemRow = {
  id: number; plan_id: number; day_index: number; slot: Slot; meal_id: number; portion_multiplier: number; reasons_json: string;
};

export type OrderRow = {
  id: number; order_number: string; client_id: number; meal_plan_id: number | null; subscription_id: number | null;
  package_id: number | null; location_id: number | null; status: OrderStatus; delivery_date: string;
  delivery_address: string; people_served: number; subtotal_zar: number; discount_zar: number;
  delivery_fee_zar: number; total_zar: number; payment_status: string; notes: string; created_at: string; updated_at: string;
};
export type OrderItemRow = {
  id: number; order_id: number; meal_id: number; meal_number: number; day_index: number | null; slot: string;
  quantity: number; portion_multiplier: number; unit_price_zar: number; unit_cost_zar: number; status: string;
};

export type SubscriptionRow = {
  id: number; client_id: number; package_id: number | null; meals_per_week: number; frequency: string;
  price_per_cycle: number; start_date: string; renewal_date: string; status: string; meals_remaining: number;
  paused_at: string | null; cancelled_at: string | null; created_at: string;
};

export type PackageRow = {
  id: number; code: string; name: string; description: string; meals_per_week: number; price_zar: number;
  is_custom: number; is_active: number; sort_order: number;
};

export type SupplierRow = {
  id: number; name: string; contact_name: string; phone: string; email: string; min_order_zar: number;
  delivery_days: string; lead_time_days: number; reliability: number; quality: number; notes: string; is_active: number;
};
export type SupplierProductRow = {
  id: number; supplier_id: number; ingredient_id: number; price_per_unit: number; pack_size: number; product_code: string; updated_at: string;
};

export type InventoryLotRow = {
  id: number; ingredient_id: number; supplier_id: number | null; purchase_order_id: number | null; batch_number: string;
  quantity_received: number; quantity_remaining: number; unit_cost: number; received_at: string;
  expiry_date: string | null; storage_location: string;
};

export type ProductionBatchRow = {
  id: number; production_date: string; meal_id: number; location_id: number | null; quantity_required: number;
  quantity_done: number; quantity_wasted: number; status: ProductionStatus; assigned_user_id: number | null;
  started_at: string | null; completed_at: string | null; qc_notes: string; created_at: string;
};

export type DeliveryRow = {
  id: number; order_id: number; client_id: number; route_id: number | null; driver_id: number | null;
  delivery_date: string; window_start: string; window_end: string; address: string; sequence: number;
  status: DeliveryStatus; proof_type: string; proof_note: string; delivered_at: string | null; failure_reason: string;
};

export type PaymentRow = {
  id: number; order_id: number | null; client_id: number; subscription_id: number | null; amount_zar: number;
  method: string; reference: string; status: string; paid_at: string; notes: string;
};
export type ExpenseRow = {
  id: number; category: string; description: string; amount_zar: number; incurred_at: string;
  supplier_id: number | null; is_recurring: number; created_at: string;
};
export type FeedbackRow = {
  id: number; client_id: number; order_id: number | null; meal_id: number | null; taste: number | null;
  portion: number | null; presentation: number | null; variety: number | null; packaging: number | null;
  overall: number | null; comment: string; created_at: string;
};
export type ProgressRow = {
  id: number; client_id: number; logged_at: string; weight_kg: number | null; waist_cm: number | null;
  adherence_pct: number | null; energy: number | null; satisfaction: number | null; water_litres: number | null;
  exercise_minutes: number | null; notes: string;
};

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
