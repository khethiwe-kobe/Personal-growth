/** Business-plan content: brand names, taglines, identity, revenue model, compliance, campaigns. */

export const VALUE_PROPOSITIONS = [
  "Personalised nutrition without the daily effort of meal planning, shopping and cooking.",
  "Your goals, translated into meals — planned, prepared and delivered.",
  "Chef-prepared meals built around your body, your schedule and your targets.",
  "Eat with intention every day, without spending your evenings in the kitchen.",
  "The convenience of delivery, the care of a personal nutrition plan.",
];

export const TARGET_SEGMENTS = [
  { segment: "Busy professionals", need: "Convenience and consistency", angle: "Office lunch subscriptions, 10–14 meal packages" },
  { segment: "Fitness enthusiasts & gym members", need: "Macro-accurate meals", angle: "High-protein and performance plans, gym partnerships" },
  { segment: "Athletes", need: "Periodised energy around training", angle: "Custom plans with professional oversight" },
  { segment: "Students", need: "Affordable, filling, healthy", angle: "Student meal plan at a lower price point" },
  { segment: "Corporate employees", need: "Wellness benefit", angle: "Corporate accounts with volume pricing" },
  { segment: "Parents & families", need: "Dinner solved for the household", angle: "Family packages with portion multipliers" },
  { segment: "People with specific nutrition goals", need: "Structure and accountability", angle: "Progress tracking and planner check-ins" },
];

export const REVENUE_STREAMS = [
  "Individual meal sales", "Weekly meal packages", "Monthly subscriptions", "Premium customised meal plans", "Family meal packages",
  "Corporate meal plans", "Fitness / gym partnerships", "Events & catering", "Nutrition consultation partnerships (referral)",
  "Premium packaging add-on", "Add-on snacks", "Drinks", "Breakfast packages",
];

export type BrandName = { name: string; meaning: string; positioning: string; tagline: string; category: "Premium" | "Modern" | "Luxury" | "Warm" | "Clinical" | "Playful"; check: boolean };

export const BRAND_NAMES: BrandName[] = [
  { name: "Nourish & Co.", meaning: "Nourishment as a partnership", positioning: "Premium, warm, personal", tagline: "Nutrition, prepared for your life.", category: "Premium", check: true },
  { name: "The Meal Atelier", meaning: "A workshop where meals are crafted", positioning: "Artisanal premium", tagline: "Crafted to your measure.", category: "Premium", check: false },
  { name: "Nourish House", meaning: "A home of nourishment", positioning: "Premium hospitality", tagline: "Welcome to better eating.", category: "Premium", check: true },
  { name: "Table & Form", meaning: "The table you eat at and the form you build", positioning: "Fitness-forward premium", tagline: "Eat for the form you want.", category: "Premium", check: false },
  { name: "The Prep Kitchen", meaning: "Literal and approachable", positioning: "Accessible premium", tagline: "Your week, prepared.", category: "Premium", check: true },
  { name: "Nourish Lab", meaning: "Nutrition with scientific rigour", positioning: "Clinical-modern", tagline: "Measured nutrition, made daily.", category: "Clinical", check: true },
  { name: "FuelHaus", meaning: "German 'house' + fuel", positioning: "Modern performance", tagline: "Fuel, delivered.", category: "Modern", check: true },
  { name: "MealForm", meaning: "Meals shaped to a goal", positioning: "Modern tech-forward", tagline: "Form follows function. So do our meals.", category: "Modern", check: true },
  { name: "PrepLab", meaning: "Preparation + laboratory", positioning: "Modern clinical", tagline: "Precision meal prep.", category: "Modern", check: true },
  { name: "MacroHaus", meaning: "Macros + house", positioning: "Fitness modern", tagline: "Your macros, our kitchen.", category: "Modern", check: true },
  { name: "Plate Theory", meaning: "The idea behind every plate", positioning: "Intelligent, modern", tagline: "Every plate has a reason.", category: "Modern", check: false },
  { name: "Fuel & Form", meaning: "Energy and physique", positioning: "Performance premium", tagline: "Fuel the form.", category: "Modern", check: false },
  { name: "Maison Nourish", meaning: "French 'house' of nourishment", positioning: "Luxury", tagline: "The art of being well fed.", category: "Luxury", check: false },
  { name: "The Nourish Collective", meaning: "A community of nourishment", positioning: "Luxury community", tagline: "Eat well, together.", category: "Luxury", check: false },
  { name: "Atelier Nutrition", meaning: "A nutrition workshop", positioning: "Luxury clinical", tagline: "Tailored nutrition, daily.", category: "Luxury", check: false },
  { name: "The Prepared Table", meaning: "A table set in advance", positioning: "Luxury hospitality", tagline: "Always set. Always ready.", category: "Luxury", check: false },
  { name: "The Wellness Kitchen", meaning: "Kitchen as wellness space", positioning: "Luxury wellness", tagline: "Wellness, plated.", category: "Luxury", check: true },
  // 30+ additional original ideas
  { name: "Kindle Kitchen", meaning: "To kindle energy and appetite", positioning: "Warm modern", tagline: "Light your week.", category: "Warm", check: false },
  { name: "Verdant Table", meaning: "Lush, flourishing table", positioning: "Premium fresh", tagline: "Flourish daily.", category: "Premium", check: false },
  { name: "Tempo Meals", meaning: "Meals that keep pace with your life", positioning: "Modern busy-professional", tagline: "Eat at your tempo.", category: "Modern", check: true },
  { name: "Portion & Purpose", meaning: "Right portion, clear purpose", positioning: "Clinical warm", tagline: "Every portion has a purpose.", category: "Clinical", check: false },
  { name: "Ember & Oat", meaning: "Fire and grain — cooking and nourishment", positioning: "Artisanal premium", tagline: "Slow care, fast mornings.", category: "Warm", check: false },
  { name: "Kweli Kitchen", meaning: "Kweli = 'truth' (Swahili)", positioning: "Honest, African-rooted premium", tagline: "Honest food, true to you.", category: "Warm", check: false },
  { name: "Ubuntu Plate", meaning: "I am because we are — shared wellbeing", positioning: "South African community premium", tagline: "Well fed, together.", category: "Warm", check: true },
  { name: "Lumen Meals", meaning: "Light / clarity", positioning: "Clean modern", tagline: "Clarity on a plate.", category: "Modern", check: true },
  { name: "Northstar Nutrition", meaning: "A guiding star", positioning: "Goal-led premium", tagline: "Guided by your goals.", category: "Premium", check: true },
  { name: "Cadence Kitchen", meaning: "Rhythm and consistency", positioning: "Modern lifestyle", tagline: "Find your eating rhythm.", category: "Modern", check: false },
  { name: "Balance Bureau", meaning: "An office of balance", positioning: "Clinical corporate", tagline: "Balanced by design.", category: "Clinical", check: false },
  { name: "Meridian Meals", meaning: "The high point of the day", positioning: "Premium modern", tagline: "Peak nutrition, every day.", category: "Premium", check: true },
  { name: "Harvest & Hale", meaning: "Harvest + 'hale' (healthy, robust)", positioning: "Premium heritage", tagline: "Hale and hearty, delivered.", category: "Premium", check: false },
  { name: "Savour Studio", meaning: "A studio for savouring", positioning: "Design-led premium", tagline: "Designed to be savoured.", category: "Premium", check: false },
  { name: "Kilo Kitchen", meaning: "Playful nod to measurement", positioning: "Fitness playful", tagline: "Every gram counts.", category: "Playful", check: true },
  { name: "Mise", meaning: "From 'mise en place' — everything in place", positioning: "Minimal luxury", tagline: "Everything in its place.", category: "Luxury", check: true },
  { name: "Proto Plate", meaning: "First principles plate", positioning: "Modern scientific", tagline: "Nutrition from first principles.", category: "Clinical", check: false },
  { name: "Sol & Season", meaning: "Sun and seasonality", positioning: "Fresh premium", tagline: "In season, on time.", category: "Warm", check: false },
  { name: "Grain & Grace", meaning: "Staple and elegance", positioning: "Warm luxury", tagline: "Eat with grace.", category: "Luxury", check: false },
  { name: "Stride Meals", meaning: "Progress with every step", positioning: "Performance modern", tagline: "Fuel your stride.", category: "Modern", check: true },
  { name: "Clarity Kitchen", meaning: "Clear thinking through clean eating", positioning: "Clinical modern", tagline: "Eat clearly.", category: "Clinical", check: false },
  { name: "Mesa Nourish", meaning: "Mesa = table (Spanish/Portuguese)", positioning: "Global premium", tagline: "Your table, nourished.", category: "Premium", check: false },
  { name: "Equinox Eats", meaning: "Balance of day and night", positioning: "Balanced modern", tagline: "Balanced, every season.", category: "Modern", check: true },
  { name: "Imbizo Kitchen", meaning: "Imbizo = gathering (isiZulu)", positioning: "South African community", tagline: "Gather around good food.", category: "Warm", check: false },
  { name: "Vital Table", meaning: "Life-giving table", positioning: "Clinical warm", tagline: "Vitality, served.", category: "Clinical", check: false },
  { name: "Noma Nourish", meaning: "'Even if' (isiZulu) — resilience", positioning: "Local premium", tagline: "Nourished, no matter what.", category: "Warm", check: true },
  { name: "Orbit Kitchen", meaning: "Meals that revolve around you", positioning: "Modern tech", tagline: "We revolve around you.", category: "Modern", check: false },
  { name: "Form Foods", meaning: "Food for form", positioning: "Fitness minimal", tagline: "Feed the form.", category: "Modern", check: true },
  { name: "Slow Fire Kitchen", meaning: "Careful cooking", positioning: "Artisanal", tagline: "Cooked with care, delivered with speed.", category: "Warm", check: false },
  { name: "Aria Nutrition", meaning: "A solo performance — your personal plan", positioning: "Luxury personal", tagline: "A plan composed for you.", category: "Luxury", check: true },
  { name: "Pulse Prep", meaning: "Energy and rhythm", positioning: "Performance", tagline: "Prep with a pulse.", category: "Playful", check: true },
  { name: "Thrive Table", meaning: "A table where you thrive", positioning: "Wellness premium", tagline: "Thrive, daily.", category: "Premium", check: true },
  { name: "Kanzi Kitchen", meaning: "Kanzi = 'treasure' (Swahili)", positioning: "Premium African", tagline: "Treasure every meal.", category: "Warm", check: false },
];

export const TAGLINES = [
  "Nutrition, prepared for your life.", "Your goals. Your meals. Prepared.", "Better eating, beautifully prepared.", "Nutrition made effortless.",
  "Eat well. Live fully.", "Personalised nutrition, prepared.", "Measured for you. Made for you.", "Every meal, on purpose.",
  "Your week, already cooked.", "Precision you can taste.", "Good food, good numbers.", "Planned by experts. Cooked with care.",
  "Nourishment without the noise.", "Eat like it matters. Because it does.", "The plan is on your plate.", "Designed around you. Delivered to you.",
  "Fuel that fits.", "Less deciding. More thriving.", "Real food. Real targets. Real results.", "Consistency, delivered.",
  "Wellness you can reheat.", "The science of eating well, made simple.", "Crafted portions. Clear goals.", "Your nutrition, handled.",
  "From assessment to plate.", "Prepared with precision, served with warmth.",
];

export const BRAND_IDENTITY = {
  logo: "A wordmark in a refined serif or high-contrast grotesque, paired with a minimal mark: a circle bisected by a thin line (plate + balance). Avoid leaves, hearts and forks.",
  typography: { display: "Fraunces or Canela (warm serif) for headlines", body: "Inter or Söhne for body and data tables", data: "Tabular figures enabled for nutrition and prices" },
  palette: [
    { name: "Bone", hex: "#F6F2EC", use: "Backgrounds, packaging base" },
    { name: "Charcoal", hex: "#1F1F1D", use: "Text, logo" },
    { name: "Terracotta", hex: "#B85C38", use: "Primary accent, CTAs, seals" },
    { name: "Sage grey", hex: "#8C9A8E", use: "Secondary, muted labels" },
    { name: "Ochre", hex: "#D9A441", use: "Breakfast category" },
    { name: "Olive", hex: "#6F7F3F", use: "Lunch category" },
    { name: "Plum", hex: "#5A3E5C", use: "Dinner category" },
    { name: "Clay", hex: "#C98E7B", use: "Snack category" },
  ],
  packaging: "Matte kraft or bone-white recyclable containers with a single wrap-around label. Front: brand wordmark, client name, meal name, 'Meal 03 of 14'. Back: nutrition table, ingredients, allergens in bold, storage, reheating, QR. A thin coloured band encodes the category.",
  photography: "Natural daylight, overhead and 45°, linen and stone surfaces, no props clutter. Show real portions, never styled over-abundance.",
  website: "Editorial layout, generous whitespace, large type, one accent colour, client stories with real progress. Assessment CTA above the fold.",
  app: "Calm dashboard: cards, status badges, progress rings; charcoal on bone; category colour bands; no gradients or glassmorphism.",
};

export const CAMPAIGN_IDEAS = [
  { name: "5-Day Healthy Reset", audience: "New clients", offer: "5 dinners + 5 lunches at an introductory price", channel: "Instagram + WhatsApp" },
  { name: "High Protein Week", audience: "Gym members", offer: "14 high-protein meals with a gym partnership code", channel: "TikTok + gym partners" },
  { name: "Office Lunch Subscription", audience: "Corporate", offer: "10 lunches/week delivered to the office", channel: "LinkedIn + email" },
  { name: "Student Meal Plan", audience: "Students", offer: "7 dinners at student pricing", channel: "TikTok + campus" },
  { name: "Fitness Meal Plan", audience: "Fitness enthusiasts", offer: "Performance package + progress tracking", channel: "Instagram" },
  { name: "Family Weekly Prep", audience: "Parents", offer: "Family package (2–4 portions per meal)", channel: "Facebook + WhatsApp" },
];

export const STARTUP_COST_DEFAULTS: { category: string; description: string; estimate: number; recurring?: boolean }[] = [
  { category: "Kitchen equipment", description: "Commercial stove, ovens, prep tables", estimate: 45000 },
  { category: "Refrigeration", description: "Walk-in / upright fridges", estimate: 25000 },
  { category: "Freezers", description: "Chest/upright freezers", estimate: 12000 },
  { category: "Cooking equipment", description: "Pots, pans, utensils, scales, thermometers", estimate: 8000 },
  { category: "Food storage", description: "Containers, racks, labelling", estimate: 4000 },
  { category: "Packaging", description: "Initial 2,000 containers + sleeves", estimate: 9000 },
  { category: "Labels", description: "Label stock, 1 month", estimate: 1500 },
  { category: "Printing", description: "Label printer", estimate: 4500 },
  { category: "Website/app", description: "Domain, hosting, this platform", estimate: 3000 },
  { category: "Branding", description: "Logo, packaging design, photography", estimate: 12000 },
  { category: "Delivery", description: "Cooler bags, vehicle costs (first month)", estimate: 6000 },
  { category: "Insurance", description: "Public liability, stock", estimate: 3500 },
  { category: "Licensing/compliance", description: "Certificate of Acceptability, business registration", estimate: 4000 },
  { category: "Marketing", description: "Launch campaign", estimate: 8000 },
  { category: "Ingredients", description: "First two weeks of stock", estimate: 15000 },
  { category: "Staff", description: "First month wages (1 cook, part-time packer)", estimate: 18000, recurring: true },
  { category: "Software", description: "Accounting, messaging, subscriptions", estimate: 1500, recurring: true },
  { category: "Contingency", description: "10 % of the above", estimate: 18000 },
];

export const COMPLIANCE_DEFAULTS: { area: string; requirement: string; guidance: string }[] = [
  { area: "Food handling", requirement: "Documented food-handling procedures for receiving, prep, cooking, cooling and packing", guidance: "Align with the South African R638 regulations (Foodstuffs, Cosmetics and Disinfectants Act) and your municipality's Certificate of Acceptability requirements. Verify with the local Environmental Health Practitioner." },
  { area: "Food storage", requirement: "Raw and cooked foods separated; chilled ≤ 5 °C, frozen ≤ −18 °C; FIFO rotation", guidance: "Inventory lots in this system support FIFO and expiry alerts; keep physical labels matching batch numbers." },
  { area: "Temperature control", requirement: "Cooking core temperature ≥ 75 °C; cooling to ≤ 5 °C within recommended time; temperature logs", guidance: "Record fridge/freezer temperatures twice daily; keep logs for inspection." },
  { area: "Allergen management", requirement: "Allergen matrix per meal, cross-contact controls, allergen declaration on labels", guidance: "Labels generated here list allergens derived from recipe ingredients; verify against actual ingredients used." },
  { area: "Labelling", requirement: "Labels compliant with R146 (Labelling and Advertising of Foodstuffs): name, ingredients, allergens, date marking, storage instructions, business details", guidance: "Nutrition claims (e.g. 'high protein') must meet regulatory thresholds — review before printing claims." },
  { area: "Expiry dates", requirement: "Best-before / use-by dates derived from validated shelf-life", guidance: "Shelf life per meal is configurable; validate with a food technologist for extended shelf life." },
  { area: "Traceability", requirement: "Batch numbers linking supplier lot → production batch → client order", guidance: "Supported through inventory lots, production batches and label tokens." },
  { area: "Cleaning", requirement: "Cleaning schedules and records for surfaces, equipment and premises", guidance: "Keep a daily checklist; store evidence here." },
  { area: "Staff hygiene", requirement: "Food-handler training, health screening, hand-washing facilities, protective clothing", guidance: "Keep training certificates for each staff member." },
  { area: "Supplier records", requirement: "Approved supplier list with contact details and certificates", guidance: "Supplier profiles here can store notes; attach certificates in your document store." },
  { area: "Waste management", requirement: "Waste segregation, pest control, disposal records", guidance: "Waste transactions are tracked in inventory; keep disposal contractor records." },
  { area: "Business registration", requirement: "CIPC registration, municipal trading licence, Certificate of Acceptability", guidance: "Required before trading; this system does not confirm legal compliance." },
  { area: "Data protection (POPIA)", requirement: "Lawful processing of personal and special personal information (health), consent, security safeguards, information officer", guidance: "Consent is captured during onboarding; register an Information Officer with the Information Regulator." },
];

export const WORKFLOW_STEPS = [
  { key: "new_client", label: "New client", href: "/clients", desc: "Lead or onboarding form submitted" },
  { key: "assessment", label: "Assessment", href: "/onboard", desc: "10-step health & lifestyle questionnaire" },
  { key: "nutrition", label: "Nutrition profile", href: "/clients", desc: "Targets computed; safety flags raised" },
  { key: "goal", label: "Goal analysis", href: "/clients", desc: "Goal-adjusted energy & macro ranges" },
  { key: "recommend", label: "Meal recommendations", href: "/clients", desc: "Scored suggestions with reasons" },
  { key: "plan", label: "Meal plan", href: "/meal-plans", desc: "Weekly plan with gap detection" },
  { key: "approval", label: "Client approval", href: "/meal-plans", desc: "Client approves in the portal" },
  { key: "order", label: "Order", href: "/orders", desc: "Order created from the approved plan" },
  { key: "payment", label: "Payment", href: "/payments", desc: "Paid → production queue" },
  { key: "grocery", label: "Grocery requirements", href: "/grocery", desc: "Aggregated from paid orders" },
  { key: "inventory", label: "Inventory check", href: "/inventory", desc: "Net of stock on hand" },
  { key: "purchasing", label: "Purchasing", href: "/suppliers", desc: "Best supplier per ingredient" },
  { key: "production", label: "Kitchen production", href: "/production", desc: "Batches by meal and date" },
  { key: "portioning", label: "Portioning", href: "/production", desc: "Batch status" },
  { key: "packaging", label: "Packaging", href: "/production", desc: "Labels with QR codes" },
  { key: "qc", label: "Quality control", href: "/production", desc: "QC notes per batch" },
  { key: "delivery", label: "Delivery", href: "/deliveries", desc: "Routes, drivers, proof of delivery" },
  { key: "feedback", label: "Client feedback", href: "/feedback", desc: "Six ratings + comments" },
  { key: "progress", label: "Progress tracking", href: "/clients", desc: "Weight, adherence, energy" },
  { key: "renewal", label: "Renewal", href: "/subscriptions", desc: "Renewal reminders and skips" },
];

export const FUTURE_AI = [
  { feature: "AI meal planner", hook: "lib/planner.ts generatePlan() — replace scoring with model ranking; same inputs" },
  { feature: "AI recipe generator", hook: "setRecipe() accepts structured lines/steps; a model can draft them from ingredient inventory" },
  { feature: "AI grocery optimiser", hook: "groceryForOrders() output → pack-size rounding & supplier split optimisation" },
  { feature: "AI cost optimiser", hook: "mealCost() + compareSuppliers() expose per-ingredient costs" },
  { feature: "AI supplier comparison", hook: "compareSuppliers() weights are a config point" },
  { feature: "AI demand forecasting", hook: "demandForecast() baseline (moving average) → seasonal model" },
  { feature: "AI inventory forecasting", hook: "inventory_transactions ledger is the training signal" },
  { feature: "AI retention prediction", hook: "atRiskClients() rule → churn model over timeline events" },
  { feature: "AI recommendation engine", hook: "scoreMeal() returns reasons — keep explanations when swapping in a learned ranker" },
  { feature: "AI marketing assistant", hook: "marketing_campaigns + feedbackInsights() → campaign copy" },
  { feature: "AI business analyst", hook: "lib/assistant.ts intents return structured data for an LLM to narrate" },
];
