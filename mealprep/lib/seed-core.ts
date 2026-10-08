import type Database from "better-sqlite3";
import { hashPassword } from "./auth";
import { STARTUP_COST_DEFAULTS, COMPLIANCE_DEFAULTS } from "./business";

/**
 * Demo business seed. Deterministic (seeded PRNG) so the demo looks the same
 * on every machine. All demo users are flagged is_demo = 1.
 */
let seedState = 42;
function rnd(): number { seedState = (seedState * 1103515245 + 12345) & 0x7fffffff; return seedState / 0x7fffffff; }
function pick<T>(arr: T[]): T { return arr[Math.floor(rnd() * arr.length)]; }
function between(a: number, b: number): number { return a + rnd() * (b - a); }
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function daysAgo(n: number): Date { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; }
function monday(d: Date): Date { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

type Ing = [name: string, cat: string, unit: string, kcal: number, p: number, c: number, f: number, fib: number, na: number, sugar: number, allergens: string[], cost: number, waste: number, storage: string, min: number];

const INGREDIENTS: Ing[] = [
  ["Chicken breast", "poultry", "g", 165, 31, 0, 3.6, 0, 74, 0, [], 0.089, 8, "chilled", 10000],
  ["Chicken thigh (skinless)", "poultry", "g", 177, 24, 0, 8, 0, 90, 0, [], 0.072, 8, "chilled", 5000],
  ["Lean beef mince", "meat", "g", 215, 26, 0, 12, 0, 70, 0, [], 0.125, 5, "chilled", 5000],
  ["Beef sirloin", "meat", "g", 206, 27, 0, 10, 0, 60, 0, [], 0.185, 6, "chilled", 2000],
  ["Lamb shoulder", "meat", "g", 250, 25, 0, 17, 0, 65, 0, [], 0.17, 10, "chilled", 0],
  ["Salmon fillet", "fish", "g", 208, 20, 0, 13, 0, 59, 0, ["fish"], 0.32, 5, "chilled", 2000],
  ["Hake fillet", "fish", "g", 90, 18, 0, 1.3, 0, 100, 0, ["fish"], 0.11, 5, "frozen", 3000],
  ["Tuna (canned, in water)", "fish", "g", 116, 26, 0, 1, 0, 320, 0, ["fish"], 0.095, 0, "ambient", 2000],
  ["Prawns", "fish", "g", 99, 24, 0.2, 0.3, 0, 110, 0, ["crustaceans"], 0.26, 5, "frozen", 0],
  ["Eggs", "dairy", "g", 155, 13, 1.1, 11, 0, 124, 1.1, ["eggs"], 0.045, 3, "chilled", 6000],
  ["Greek yoghurt (plain)", "dairy", "g", 97, 9, 3.6, 5, 0, 36, 3.6, ["milk"], 0.06, 2, "chilled", 4000],
  ["Feta cheese", "dairy", "g", 264, 14, 4, 21, 0, 917, 4, ["milk"], 0.14, 2, "chilled", 1000],
  ["Cheddar cheese", "dairy", "g", 403, 25, 1.3, 33, 0, 621, 0.5, ["milk"], 0.13, 2, "chilled", 1000],
  ["Low-fat milk", "dairy", "ml", 47, 3.4, 4.8, 1.5, 0, 44, 4.8, ["milk"], 0.018, 2, "chilled", 4000],
  ["Brown rice", "grains", "g", 123, 2.7, 26, 1, 1.6, 4, 0.4, [], 0.03, 2, "ambient", 10000],
  ["Basmati rice", "grains", "g", 130, 2.7, 28, 0.3, 0.4, 1, 0, [], 0.028, 2, "ambient", 10000],
  ["Quinoa", "grains", "g", 120, 4.4, 21, 1.9, 2.8, 7, 0.9, [], 0.09, 2, "ambient", 3000],
  ["Rolled oats", "grains", "g", 379, 13, 68, 6.5, 10, 6, 1, ["gluten"], 0.035, 1, "ambient", 5000],
  ["Whole-wheat pasta", "grains", "g", 124, 5, 26, 0.6, 3.9, 4, 0.7, ["gluten"], 0.04, 2, "ambient", 4000],
  ["Sweet potato", "vegetables", "g", 86, 1.6, 20, 0.1, 3, 55, 4.2, [], 0.022, 15, "ambient", 6000],
  ["Baby potatoes", "vegetables", "g", 77, 2, 17, 0.1, 2.2, 6, 0.8, [], 0.02, 8, "ambient", 5000],
  ["Broccoli", "vegetables", "g", 34, 2.8, 7, 0.4, 2.6, 33, 1.7, [], 0.045, 20, "chilled", 5000],
  ["Spinach", "vegetables", "g", 23, 2.9, 3.6, 0.4, 2.2, 79, 0.4, [], 0.06, 10, "chilled", 2000],
  ["Red pepper", "vegetables", "g", 31, 1, 6, 0.3, 2.1, 4, 4.2, [], 0.05, 12, "chilled", 3000],
  ["Carrots", "vegetables", "g", 41, 0.9, 10, 0.2, 2.8, 69, 4.7, [], 0.018, 12, "chilled", 4000],
  ["Courgette", "vegetables", "g", 17, 1.2, 3.1, 0.3, 1, 8, 2.5, [], 0.035, 8, "chilled", 3000],
  ["Butternut", "vegetables", "g", 45, 1, 12, 0.1, 2, 4, 2.2, [], 0.02, 25, "ambient", 4000],
  ["Onion", "vegetables", "g", 40, 1.1, 9, 0.1, 1.7, 4, 4.2, [], 0.016, 12, "ambient", 5000],
  ["Garlic", "vegetables", "g", 149, 6.4, 33, 0.5, 2.1, 17, 1, [], 0.09, 15, "ambient", 500],
  ["Tomatoes", "vegetables", "g", 18, 0.9, 3.9, 0.2, 1.2, 5, 2.6, [], 0.03, 8, "chilled", 4000],
  ["Cherry tomatoes", "vegetables", "g", 18, 0.9, 3.9, 0.2, 1.2, 5, 2.6, [], 0.06, 5, "chilled", 1500],
  ["Mixed salad leaves", "vegetables", "g", 17, 1.5, 2.9, 0.2, 1.8, 28, 0.8, [], 0.08, 10, "chilled", 1500],
  ["Cucumber", "vegetables", "g", 15, 0.7, 3.6, 0.1, 0.5, 2, 1.7, [], 0.025, 8, "chilled", 2000],
  ["Cauliflower", "vegetables", "g", 25, 1.9, 5, 0.3, 2, 30, 1.9, [], 0.03, 25, "chilled", 3000],
  ["Green beans", "vegetables", "g", 31, 1.8, 7, 0.2, 2.7, 6, 3.3, [], 0.05, 10, "chilled", 2000],
  ["Mushrooms", "vegetables", "g", 22, 3.1, 3.3, 0.3, 1, 5, 2, [], 0.07, 8, "chilled", 1500],
  ["Banana", "fruit", "g", 89, 1.1, 23, 0.3, 2.6, 1, 12, [], 0.022, 35, "ambient", 3000],
  ["Blueberries", "fruit", "g", 57, 0.7, 14, 0.3, 2.4, 1, 10, [], 0.16, 5, "chilled", 1000],
  ["Apple", "fruit", "g", 52, 0.3, 14, 0.2, 2.4, 1, 10, [], 0.025, 10, "chilled", 3000],
  ["Lemon", "fruit", "g", 29, 1.1, 9, 0.3, 2.8, 2, 2.5, [], 0.035, 30, "ambient", 1000],
  ["Avocado", "fruit", "g", 160, 2, 9, 15, 7, 7, 0.7, [], 0.06, 30, "ambient", 2000],
  ["Chickpeas (cooked)", "legumes", "g", 164, 8.9, 27, 2.6, 7.6, 7, 4.8, [], 0.03, 0, "ambient", 4000],
  ["Black beans (cooked)", "legumes", "g", 132, 8.9, 24, 0.5, 8.7, 2, 0.3, [], 0.03, 0, "ambient", 3000],
  ["Red lentils (dry)", "legumes", "g", 352, 25, 60, 1.1, 11, 6, 2, [], 0.04, 0, "ambient", 4000],
  ["Firm tofu", "legumes", "g", 76, 8, 1.9, 4.8, 0.3, 7, 0.6, ["soy"], 0.07, 2, "chilled", 1500],
  ["Olive oil", "pantry", "ml", 884, 0, 0, 100, 0, 2, 0, [], 0.12, 0, "ambient", 2000],
  ["Coconut milk", "pantry", "ml", 197, 2, 3, 21, 0, 15, 3, [], 0.04, 0, "ambient", 2000],
  ["Peanut butter", "pantry", "g", 588, 25, 20, 50, 6, 17, 9, ["peanuts"], 0.08, 0, "ambient", 1000],
  ["Almonds", "pantry", "g", 579, 21, 22, 50, 12, 1, 4.4, ["tree_nuts"], 0.22, 0, "ambient", 1000],
  ["Chia seeds", "pantry", "g", 486, 17, 42, 31, 34, 16, 0, [], 0.18, 0, "ambient", 500],
  ["Honey", "pantry", "g", 304, 0.3, 82, 0, 0.2, 4, 82, [], 0.09, 0, "ambient", 1000],
  ["Whey protein", "pantry", "g", 400, 80, 8, 6, 0, 200, 4, ["milk"], 0.35, 0, "ambient", 1000],
  ["Tomato passata", "sauces", "ml", 32, 1.5, 5, 0.3, 1.5, 20, 4, [], 0.025, 0, "ambient", 3000],
  ["Soy sauce", "sauces", "ml", 53, 8, 5, 0, 0.8, 5493, 0.4, ["soy", "gluten"], 0.04, 0, "ambient", 1000],
  ["Curry paste (Thai green)", "sauces", "g", 120, 2, 12, 7, 2, 2400, 5, [], 0.09, 0, "ambient", 500],
  ["Mixed herbs & spices", "herbs_spices", "g", 250, 10, 50, 7, 25, 50, 2, [], 0.25, 0, "ambient", 500],
  ["Cumin & coriander blend", "herbs_spices", "g", 375, 18, 44, 22, 10, 168, 2, [], 0.22, 0, "ambient", 300],
  ["Fresh coriander", "herbs_spices", "g", 23, 2.1, 3.7, 0.5, 2.8, 46, 0.9, [], 0.12, 20, "chilled", 300],
  ["Salt & pepper", "herbs_spices", "g", 0, 0, 0, 0, 0, 38000, 0, [], 0.02, 0, "ambient", 500],
  ["Meal container (750 ml)", "packaging", "each", 0, 0, 0, 0, 0, 0, 0, [], 3.8, 0, "ambient", 300],
  ["Label sheet", "packaging", "each", 0, 0, 0, 0, 0, 0, 0, [], 0.9, 0, "ambient", 300],
];

type MealDef = {
  name: string; category: string; cuisine: string; description: string; servings: number; size: number; prep: number; cook: number; temp: number | null;
  shelf: number; tags: string[]; complexity: number; price: number; tier: string; lines: [string, number][]; steps: string[]; safety?: string;
};

const MEALS: MealDef[] = [
  { name: "Overnight oats with blueberries", category: "breakfast", cuisine: "Modern", description: "Rolled oats soaked in milk and yoghurt with chia, honey and blueberries.", servings: 4, size: 320, prep: 10, cook: 0, temp: null, shelf: 4, tags: ["vegetarian", "high_protein"], complexity: 1, price: 65, tier: "basic",
    lines: [["Rolled oats", 240], ["Low-fat milk", 600], ["Greek yoghurt (plain)", 300], ["Chia seeds", 30], ["Honey", 40], ["Blueberries", 200]],
    steps: ["Combine oats, milk, yoghurt and chia in a large bowl.", "Stir in honey; portion into 4 containers.", "Top with blueberries; refrigerate overnight."], safety: "Keep chilled; consume within 4 days." },
  { name: "Spinach & feta egg muffins", category: "breakfast", cuisine: "Mediterranean", description: "Baked egg muffins with spinach, feta and cherry tomatoes. Three per serving.", servings: 4, size: 220, prep: 15, cook: 22, temp: 180, shelf: 4, tags: ["vegetarian", "lower_carb", "gluten_free", "high_protein"], complexity: 2, price: 70, tier: "standard",
    lines: [["Eggs", 600], ["Spinach", 150], ["Feta cheese", 120], ["Cherry tomatoes", 150], ["Onion", 60], ["Olive oil", 15], ["Salt & pepper", 3]],
    steps: ["Preheat oven to 180 °C; oil a 12-hole muffin tin.", "Sauté onion and spinach 3 min; cool.", "Whisk eggs, fold in vegetables, feta and tomatoes.", "Bake 20–22 min until set (core 75 °C)."], safety: "Cool within 90 minutes before chilling." },
  { name: "Banana protein pancakes", category: "breakfast", cuisine: "Modern", description: "Oat and banana pancakes with whey protein, served with Greek yoghurt.", servings: 4, size: 260, prep: 10, cook: 15, temp: null, shelf: 3, tags: ["vegetarian", "high_protein"], complexity: 2, price: 70, tier: "standard",
    lines: [["Rolled oats", 200], ["Banana", 300], ["Eggs", 200], ["Whey protein", 60], ["Low-fat milk", 150], ["Greek yoghurt (plain)", 200], ["Olive oil", 15]],
    steps: ["Blend oats, banana, eggs, whey and milk.", "Cook pancakes 2 min per side on medium heat.", "Portion 3 pancakes with 50 g yoghurt."] },
  { name: "Shakshuka with chickpeas", category: "breakfast", cuisine: "Middle Eastern", description: "Eggs poached in spiced tomato and pepper sauce with chickpeas.", servings: 4, size: 350, prep: 10, cook: 25, temp: null, shelf: 3, tags: ["vegetarian", "gluten_free", "dairy_free"], complexity: 2, price: 68, tier: "basic",
    lines: [["Eggs", 400], ["Tomato passata", 600], ["Red pepper", 200], ["Onion", 150], ["Garlic", 10], ["Chickpeas (cooked)", 300], ["Cumin & coriander blend", 8], ["Olive oil", 20]],
    steps: ["Sauté onion, pepper, garlic in oil 6 min.", "Add passata, spices, chickpeas; simmer 10 min.", "Make wells, crack in eggs, cover and cook 6–8 min."] },
  { name: "Greek yoghurt parfait", category: "breakfast", cuisine: "Modern", description: "Greek yoghurt layered with oats, almonds, honey and apple.", servings: 4, size: 280, prep: 8, cook: 0, temp: null, shelf: 3, tags: ["vegetarian", "high_protein"], complexity: 1, price: 60, tier: "basic",
    lines: [["Greek yoghurt (plain)", 700], ["Rolled oats", 120], ["Almonds", 60], ["Honey", 40], ["Apple", 300]],
    steps: ["Toast oats and almonds 5 min.", "Layer yoghurt, oats, apple; drizzle honey."] },

  { name: "High-protein chicken rice bowl", category: "lunch", cuisine: "Asian", description: "Grilled chicken breast over brown rice with broccoli, carrots and a soy-sesame glaze.", servings: 4, size: 420, prep: 15, cook: 30, temp: 200, shelf: 4, tags: ["high_protein", "dairy_free"], complexity: 2, price: 95, tier: "standard",
    lines: [["Chicken breast", 600], ["Brown rice", 320], ["Broccoli", 400], ["Carrots", 200], ["Soy sauce", 40], ["Garlic", 10], ["Olive oil", 20], ["Mixed herbs & spices", 6]],
    steps: ["Cook rice (45 min absorption method).", "Season chicken; roast 200 °C 22 min (core 75 °C).", "Steam broccoli and carrots 5 min.", "Slice chicken, glaze with soy and garlic, portion."], safety: "Chicken core temperature must reach 75 °C." },
  { name: "Mediterranean quinoa salad with tuna", category: "lunch", cuisine: "Mediterranean", description: "Quinoa with tuna, cucumber, cherry tomatoes, feta and lemon dressing.", servings: 4, size: 380, prep: 15, cook: 20, temp: null, shelf: 3, tags: ["high_protein", "gluten_free", "pescatarian"], complexity: 1, price: 92, tier: "standard",
    lines: [["Quinoa", 280], ["Tuna (canned, in water)", 400], ["Cucumber", 200], ["Cherry tomatoes", 250], ["Feta cheese", 100], ["Lemon", 60], ["Olive oil", 30], ["Mixed salad leaves", 100]],
    steps: ["Cook quinoa 15 min; cool.", "Combine with flaked tuna, vegetables and feta.", "Dress with lemon and oil; portion over leaves."] },
  { name: "Beef & black bean burrito bowl", category: "lunch", cuisine: "Mexican", description: "Spiced beef mince with black beans, basmati rice, peppers and avocado.", servings: 4, size: 440, prep: 15, cook: 25, temp: null, shelf: 4, tags: ["high_protein", "gluten_free", "dairy_free"], complexity: 2, price: 98, tier: "standard",
    lines: [["Lean beef mince", 500], ["Black beans (cooked)", 300], ["Basmati rice", 300], ["Red pepper", 200], ["Onion", 120], ["Tomatoes", 200], ["Avocado", 200], ["Cumin & coriander blend", 10], ["Olive oil", 15]],
    steps: ["Cook rice.", "Brown mince with onion and spices; add beans and tomatoes, simmer 10 min.", "Portion rice, beef, peppers; add avocado on delivery day."] },
  { name: "Chickpea & roast vegetable salad", category: "lunch", cuisine: "Mediterranean", description: "Roast butternut, pepper and courgette with chickpeas, spinach and lemon-herb dressing.", servings: 4, size: 400, prep: 15, cook: 35, temp: 200, shelf: 4, tags: ["vegan", "vegetarian", "gluten_free", "dairy_free"], complexity: 1, price: 82, tier: "basic",
    lines: [["Chickpeas (cooked)", 500], ["Butternut", 400], ["Red pepper", 200], ["Courgette", 250], ["Spinach", 150], ["Lemon", 60], ["Olive oil", 30], ["Mixed herbs & spices", 8]],
    steps: ["Roast vegetables at 200 °C for 30 min.", "Toss with chickpeas, spinach and dressing."] },
  { name: "Lemon herb chicken wrap bowl", category: "lunch", cuisine: "Modern", description: "Shredded lemon-herb chicken thigh with mixed leaves, cucumber, tomato and a yoghurt dressing.", servings: 4, size: 380, prep: 15, cook: 30, temp: 190, shelf: 3, tags: ["high_protein", "lower_carb", "gluten_free"], complexity: 2, price: 90, tier: "standard",
    lines: [["Chicken thigh (skinless)", 600], ["Mixed salad leaves", 200], ["Cucumber", 200], ["Tomatoes", 200], ["Greek yoghurt (plain)", 150], ["Lemon", 60], ["Mixed herbs & spices", 8], ["Olive oil", 20]],
    steps: ["Marinate chicken in lemon, herbs and oil 15 min.", "Roast at 190 °C 25 min; shred.", "Portion with salad; dressing in a separate pot."] },
  { name: "Tofu & vegetable stir-fry", category: "lunch", cuisine: "Asian", description: "Crispy tofu with broccoli, peppers, mushrooms and basmati rice in a garlic-soy sauce.", servings: 4, size: 420, prep: 15, cook: 20, temp: null, shelf: 4, tags: ["vegan", "vegetarian", "dairy_free"], complexity: 2, price: 85, tier: "basic",
    lines: [["Firm tofu", 500], ["Broccoli", 300], ["Red pepper", 200], ["Mushrooms", 200], ["Basmati rice", 300], ["Soy sauce", 45], ["Garlic", 10], ["Olive oil", 25]],
    steps: ["Press and cube tofu; pan-fry until golden.", "Stir-fry vegetables 5 min; add sauce.", "Portion with rice."] },

  { name: "Salmon with sweet potato & green beans", category: "dinner", cuisine: "Modern", description: "Baked salmon fillet, roasted sweet potato wedges and lemon green beans.", servings: 4, size: 420, prep: 10, cook: 30, temp: 200, shelf: 3, tags: ["high_protein", "gluten_free", "dairy_free", "pescatarian"], complexity: 2, price: 145, tier: "premium",
    lines: [["Salmon fillet", 560], ["Sweet potato", 600], ["Green beans", 300], ["Lemon", 60], ["Olive oil", 30], ["Salt & pepper", 3]],
    steps: ["Roast sweet potato wedges at 200 °C 25 min.", "Bake salmon 12–14 min (core 63 °C).", "Blanch green beans 3 min; dress with lemon."], safety: "Fish is best consumed within 3 days of preparation." },
  { name: "Beef sirloin with baby potatoes & broccoli", category: "dinner", cuisine: "Modern", description: "Seared sirloin, herbed baby potatoes and steamed broccoli.", servings: 4, size: 430, prep: 10, cook: 30, temp: null, shelf: 4, tags: ["high_protein", "gluten_free", "dairy_free"], complexity: 2, price: 140, tier: "premium",
    lines: [["Beef sirloin", 560], ["Baby potatoes", 600], ["Broccoli", 400], ["Garlic", 10], ["Olive oil", 25], ["Mixed herbs & spices", 6]],
    steps: ["Boil baby potatoes 15 min; toss in oil, garlic and herbs; roast 10 min.", "Sear sirloin 3 min per side; rest; slice.", "Steam broccoli 5 min."] },
  { name: "Thai green chicken curry", category: "dinner", cuisine: "Thai", description: "Chicken thigh in coconut green curry with courgette and peppers over basmati rice.", servings: 4, size: 450, prep: 15, cook: 30, temp: null, shelf: 4, tags: ["gluten_free", "dairy_free"], complexity: 2, price: 110, tier: "standard",
    lines: [["Chicken thigh (skinless)", 600], ["Coconut milk", 400], ["Curry paste (Thai green)", 60], ["Courgette", 250], ["Red pepper", 200], ["Basmati rice", 300], ["Fresh coriander", 20], ["Olive oil", 15]],
    steps: ["Fry paste in oil 1 min; add chicken, brown.", "Add coconut milk; simmer 15 min; add vegetables 5 min.", "Portion over rice; garnish coriander."] },
  { name: "Lentil & butternut dahl", category: "dinner", cuisine: "Indian", description: "Red lentil dahl with butternut, spinach and spices, served with basmati rice.", servings: 4, size: 450, prep: 10, cook: 35, temp: null, shelf: 5, tags: ["vegan", "vegetarian", "gluten_free", "dairy_free"], complexity: 1, price: 80, tier: "basic",
    lines: [["Red lentils (dry)", 300], ["Butternut", 400], ["Spinach", 150], ["Onion", 150], ["Garlic", 10], ["Cumin & coriander blend", 12], ["Coconut milk", 200], ["Basmati rice", 300], ["Olive oil", 15]],
    steps: ["Sauté onion, garlic, spices.", "Add lentils, butternut and 1 L water; simmer 25 min.", "Stir in spinach and coconut milk.", "Portion with rice."] },
  { name: "Hake with cauliflower mash & spinach", category: "dinner", cuisine: "Modern", description: "Baked hake with lemon, creamy cauliflower mash and wilted spinach.", servings: 4, size: 400, prep: 10, cook: 25, temp: 190, shelf: 3, tags: ["high_protein", "lower_carb", "gluten_free", "pescatarian"], complexity: 2, price: 105, tier: "standard",
    lines: [["Hake fillet", 600], ["Cauliflower", 600], ["Spinach", 200], ["Low-fat milk", 100], ["Lemon", 60], ["Olive oil", 25], ["Salt & pepper", 3]],
    steps: ["Steam cauliflower 12 min; blend with milk.", "Bake hake at 190 °C 15 min.", "Wilt spinach 2 min."] },
  { name: "Chicken & vegetable pasta bake", category: "dinner", cuisine: "Italian", description: "Whole-wheat pasta with chicken, passata, courgette and a cheddar crust.", servings: 4, size: 440, prep: 15, cook: 35, temp: 190, shelf: 4, tags: ["high_protein"], complexity: 2, price: 95, tier: "standard",
    lines: [["Whole-wheat pasta", 320], ["Chicken breast", 500], ["Tomato passata", 500], ["Courgette", 250], ["Onion", 120], ["Garlic", 10], ["Cheddar cheese", 100], ["Olive oil", 15], ["Mixed herbs & spices", 6]],
    steps: ["Cook pasta al dente.", "Sauté chicken, onion, courgette; add passata.", "Combine, top with cheddar; bake 190 °C 20 min."] },
  { name: "Lamb & chickpea stew", category: "dinner", cuisine: "Moroccan", description: "Slow-cooked lamb shoulder with chickpeas, carrots and warm spices over couscous-style quinoa.", servings: 4, size: 450, prep: 20, cook: 90, temp: null, shelf: 4, tags: ["gluten_free", "dairy_free"], complexity: 3, price: 135, tier: "premium",
    lines: [["Lamb shoulder", 600], ["Chickpeas (cooked)", 300], ["Carrots", 250], ["Onion", 150], ["Tomato passata", 400], ["Cumin & coriander blend", 12], ["Quinoa", 250], ["Olive oil", 20]],
    steps: ["Brown lamb; set aside.", "Sauté onion, carrots, spices; return lamb with passata and 500 ml water; simmer 75 min.", "Add chickpeas 10 min before end.", "Serve over quinoa."] },
  { name: "Prawn & courgette noodles", category: "dinner", cuisine: "Asian", description: "Garlic prawns with courgette ribbons, peppers and a light soy dressing.", servings: 4, size: 360, prep: 15, cook: 12, temp: null, shelf: 2, tags: ["high_protein", "lower_carb", "dairy_free", "pescatarian"], complexity: 2, price: 150, tier: "premium",
    lines: [["Prawns", 500], ["Courgette", 600], ["Red pepper", 200], ["Garlic", 12], ["Soy sauce", 30], ["Lemon", 40], ["Olive oil", 25]],
    steps: ["Spiralise courgette.", "Sauté garlic and prawns 4 min.", "Toss with courgette and dressing 2 min."], safety: "Shellfish — consume within 2 days." },
  { name: "Beef mince & lentil cottage pie", category: "dinner", cuisine: "British", description: "Lean mince and lentils under a sweet potato mash.", servings: 4, size: 450, prep: 20, cook: 45, temp: 190, shelf: 4, tags: ["high_protein", "gluten_free"], complexity: 2, price: 98, tier: "standard",
    lines: [["Lean beef mince", 400], ["Red lentils (dry)", 100], ["Sweet potato", 700], ["Carrots", 200], ["Onion", 150], ["Tomato passata", 300], ["Low-fat milk", 80], ["Olive oil", 15], ["Mixed herbs & spices", 6]],
    steps: ["Brown mince, onion, carrots; add lentils, passata, 300 ml water; simmer 20 min.", "Mash boiled sweet potato with milk.", "Top and bake 190 °C 20 min."] },

  { name: "Protein energy balls", category: "snack", cuisine: "Modern", description: "Oats, peanut butter, whey and honey rolled into balls. Three per serving.", servings: 8, size: 60, prep: 15, cook: 0, temp: null, shelf: 7, tags: ["vegetarian", "high_protein"], complexity: 1, price: 35, tier: "basic",
    lines: [["Rolled oats", 200], ["Peanut butter", 160], ["Whey protein", 60], ["Honey", 60], ["Chia seeds", 20]],
    steps: ["Combine all; roll into 24 balls; chill."] },
  { name: "Greek yoghurt with almonds & honey", category: "snack", cuisine: "Modern", description: "Greek yoghurt topped with toasted almonds and honey.", servings: 4, size: 180, prep: 5, cook: 0, temp: null, shelf: 4, tags: ["vegetarian", "high_protein", "gluten_free", "lower_carb"], complexity: 1, price: 38, tier: "basic",
    lines: [["Greek yoghurt (plain)", 600], ["Almonds", 60], ["Honey", 30]],
    steps: ["Portion yoghurt; top with almonds and honey."] },
  { name: "Boiled eggs & veggie sticks", category: "snack", cuisine: "Modern", description: "Two boiled eggs with carrot and cucumber sticks.", servings: 4, size: 200, prep: 10, cook: 10, temp: null, shelf: 4, tags: ["vegetarian", "high_protein", "gluten_free", "dairy_free", "lower_carb"], complexity: 1, price: 32, tier: "basic",
    lines: [["Eggs", 400], ["Carrots", 200], ["Cucumber", 200]],
    steps: ["Boil eggs 9 min; cool in iced water; peel.", "Cut vegetables into sticks."] },
  { name: "Apple with peanut butter", category: "snack", cuisine: "Modern", description: "Sliced apple with a peanut butter pot.", servings: 4, size: 170, prep: 5, cook: 0, temp: null, shelf: 2, tags: ["vegan", "vegetarian", "gluten_free", "dairy_free"], complexity: 1, price: 28, tier: "basic",
    lines: [["Apple", 600], ["Peanut butter", 80]],
    steps: ["Slice apples; add lemon to prevent browning; portion with peanut butter."] },
  { name: "Chia pudding with blueberries", category: "dessert", cuisine: "Modern", description: "Coconut chia pudding with blueberries.", servings: 4, size: 180, prep: 5, cook: 0, temp: null, shelf: 4, tags: ["vegan", "vegetarian", "gluten_free", "dairy_free"], complexity: 1, price: 40, tier: "standard",
    lines: [["Chia seeds", 80], ["Coconut milk", 400], ["Honey", 20], ["Blueberries", 150]],
    steps: ["Whisk chia, coconut milk and honey; chill 4 h; top with blueberries."] },
  { name: "Berry protein smoothie", category: "drink", cuisine: "Modern", description: "Blueberry, banana, whey and milk smoothie.", servings: 4, size: 350, prep: 5, cook: 0, temp: null, shelf: 2, tags: ["vegetarian", "high_protein"], complexity: 1, price: 45, tier: "standard",
    lines: [["Blueberries", 200], ["Banana", 300], ["Whey protein", 80], ["Low-fat milk", 800]],
    steps: ["Blend; bottle; chill."] },
];

const FIRST = ["Thandiwe", "Sipho", "Megan", "Lerato", "Jason", "Naledi", "Pieter", "Ayesha", "Kabelo", "Chloe", "Themba", "Zanele", "Ruan", "Priya"];
const LAST = ["Mokoena", "Ndlovu", "van der Merwe", "Dlamini", "Smith", "Khumalo", "Botha", "Patel", "Molefe", "Williams", "Zulu", "Nkosi", "Pretorius", "Naidoo"];
const SUBURBS = ["Rosebank, Johannesburg", "Sandton, Johannesburg", "Melville, Johannesburg", "Parkhurst, Johannesburg", "Bryanston, Johannesburg", "Greenside, Johannesburg", "Fourways, Johannesburg", "Randburg, Johannesburg"];

export function seed(db: Database.Database, opts: { verbose?: boolean } = {}) {
  const log = (s: string) => { if (opts.verbose) console.log(s); };
  const today = daysAgo(0);

  // ---- users (one per role)
  const users: Record<string, number> = {};
  const insUser = db.prepare("INSERT INTO users (email, password_hash, name, role, phone, is_demo) VALUES (?, ?, ?, ?, ?, 1)");
  for (const [email, name, role] of [
    ["owner@demo.local", "Khethiwe Kobe", "admin"], ["planner@demo.local", "Naledi Sithole", "planner"], ["kitchen@demo.local", "Chef Thabo Mahlangu", "kitchen"],
    ["packaging@demo.local", "Lindiwe Zwane", "packaging"], ["driver@demo.local", "Sam Jacobs", "delivery"], ["accounts@demo.local", "Riaan de Wet", "accounting"],
  ]) users[role] = Number(insUser.run(email, hashPassword(`${role}-demo`), name, role, "+27 82 000 0000").lastInsertRowid);
  log("users");

  // ---- ingredients
  const ingId = new Map<string, number>();
  const insIng = db.prepare("INSERT INTO ingredients (name, category, base_unit, kcal_per_100, protein_per_100, carbs_per_100, fat_per_100, fibre_per_100, sodium_mg_per_100, sugar_per_100, allergens, default_cost_per_unit, waste_pct, storage, min_stock, seasonal_months) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  for (const i of INGREDIENTS) {
    const seasonal = i[0] === "Blueberries" ? [10, 11, 12, 1, 2] : i[0] === "Butternut" ? [2, 3, 4, 5, 6, 7] : [];
    ingId.set(i[0], Number(insIng.run(i[0], i[1], i[2], i[3], i[4], i[5], i[6], i[7], i[8], i[9], JSON.stringify(i[10]), i[11], i[12], i[13], i[14], JSON.stringify(seasonal)).lastInsertRowid));
  }
  log("ingredients");

  // ---- suppliers & prices
  const supIds: number[] = [];
  const insSup = db.prepare("INSERT INTO suppliers (name, contact_name, phone, email, min_order_zar, delivery_days, lead_time_days, reliability, quality, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  supIds.push(Number(insSup.run("Fresh Fields Produce", "Anele M.", "+27 11 555 0101", "orders@freshfields.local", 500, JSON.stringify(["mon", "wed", "fri"]), 1, 4, 4, "Best for vegetables & fruit").lastInsertRowid));
  supIds.push(Number(insSup.run("Highveld Meats", "Johan K.", "+27 11 555 0202", "sales@highveldmeats.local", 1500, JSON.stringify(["tue", "thu"]), 2, 5, 5, "Premium poultry & beef; reliable").lastInsertRowid));
  supIds.push(Number(insSup.run("Cash & Carry Wholesale", "Counter", "+27 11 555 0303", "", 0, JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat"]), 0, 3, 3, "Collect yourself; cheapest dry goods").lastInsertRowid));
  supIds.push(Number(insSup.run("Ocean Catch Seafood", "Fatima S.", "+27 21 555 0404", "orders@oceancatch.local", 1000, JSON.stringify(["wed"]), 3, 4, 5, "Fish & prawns").lastInsertRowid));
  const insSP = db.prepare("INSERT INTO supplier_products (supplier_id, ingredient_id, price_per_unit, pack_size) VALUES (?, ?, ?, ?)");
  const insHist = db.prepare("INSERT INTO supplier_price_history (supplier_product_id, price_per_unit, recorded_at) VALUES (?, ?, ?)");
  for (const i of INGREDIENTS) {
    const id = ingId.get(i[0])!;
    const base = i[11];
    const cat = i[1];
    const candidates: [number, number][] = [];
    if (["vegetables", "fruit", "herbs_spices"].includes(cat)) { candidates.push([supIds[0], base * 1.0], [supIds[2], base * 1.12]); }
    else if (["meat", "poultry"].includes(cat)) { candidates.push([supIds[1], base * 1.0], [supIds[2], base * 0.93]); }
    else if (cat === "fish") { candidates.push([supIds[3], base * 1.0], [supIds[2], base * 1.08]); }
    else if (cat === "dairy") { candidates.push([supIds[2], base * 1.0], [supIds[0], base * 1.05]); }
    else candidates.push([supIds[2], base * 1.0]);
    for (const [sid, price] of candidates) {
      const spId = Number(insSP.run(sid, id, Math.round(price * 10000) / 10000, i[2] === "each" ? 50 : 1000).lastInsertRowid);
      insHist.run(spId, Math.round(price * 0.96 * 10000) / 10000, iso(daysAgo(60)));
      insHist.run(spId, Math.round(price * 10000) / 10000, iso(daysAgo(10)));
    }
  }
  log("suppliers");

  // ---- packaging items
  const insPack = db.prepare("INSERT INTO packaging_items (name, unit_cost, stock, min_stock, supplier_id) VALUES (?, ?, ?, ?, ?)");
  insPack.run("750 ml recyclable container + lid", 3.8, 640, 300, supIds[2]);
  insPack.run("Wrap-around label (A6)", 0.9, 900, 300, supIds[2]);
  insPack.run("Insulated delivery bag (reusable)", 85, 24, 10, supIds[2]);
  insPack.run("Kraft sleeve", 1.8, 400, 200, supIds[2]);

  // ---- meals & recipes
  const mealIds: number[] = [];
  const mealByName = new Map<string, number>();
  const insMeal = db.prepare("INSERT INTO meals (name, category, cuisine, description, servings, serving_size_g, prep_minutes, cook_minutes, cook_temp_c, shelf_life_days, food_safety_notes, dietary_tags, complexity, selling_price, tier, internal_rating, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insRecipe = db.prepare("INSERT INTO recipes (meal_id, steps_json, portion_note) VALUES (?, ?, ?)");
  const insLine = db.prepare("INSERT INTO recipe_ingredients (meal_id, ingredient_id, quantity, sort_order) VALUES (?, ?, ?, ?)");
  for (const m of MEALS) {
    const id = Number(insMeal.run(m.name, m.category, m.cuisine, m.description, m.servings, m.size, m.prep, m.cook, m.temp, m.shelf, m.safety ?? "", JSON.stringify(m.tags), m.complexity, m.price, m.tier, 3 + Math.round(rnd() * 2), iso(daysAgo(120))).lastInsertRowid);
    mealIds.push(id); mealByName.set(m.name, id);
    insRecipe.run(id, JSON.stringify(m.steps.map((text, i) => ({ title: `Step ${i + 1}`, text }))), `${m.size} g per portion`);
    m.lines.forEach(([ing, qty], i) => insLine.run(id, ingId.get(ing)!, qty, i));
  }
  log("meals");

  // ---- packages
  const insPkg = db.prepare("INSERT INTO packages (code, name, description, meals_per_week, price_zar, is_custom, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const pkg: Record<string, number> = {};
  pkg.starter = Number(insPkg.run("STARTER", "Starter", "5 meals per week — a light introduction.", 5, 475, 0, 1).lastInsertRowid);
  pkg.balanced = Number(insPkg.run("BALANCED", "Balanced", "10 meals per week — lunches and dinners.", 10, 900, 0, 2).lastInsertRowid);
  pkg.performance = Number(insPkg.run("PERFORMANCE", "Performance", "14 meals per week — two meals a day, every day.", 14, 1225, 0, 3).lastInsertRowid);
  pkg.complete = Number(insPkg.run("COMPLETE", "Complete", "21 meals per week — breakfast, lunch and dinner.", 21, 1750, 0, 4).lastInsertRowid);
  pkg.family = Number(insPkg.run("FAMILY", "Family", "Custom number of meals, multiple portions per meal.", 14, 2300, 1, 5).lastInsertRowid);
  pkg.premium = Number(insPkg.run("PREMIUM", "Premium Custom", "Fully personalised planning and preparation with planner check-ins.", 21, 2450, 1, 6).lastInsertRowid);

  // ---- inventory lots
  const insLot = db.prepare("INSERT INTO inventory_lots (ingredient_id, supplier_id, batch_number, quantity_received, quantity_remaining, unit_cost, received_at, expiry_date, storage_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insTx = db.prepare("INSERT INTO inventory_transactions (lot_id, ingredient_id, type, quantity, reason, reference_type, user_id, created_at) VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)");
  let lotN = 1000;
  for (const i of INGREDIENTS) {
    const id = ingId.get(i[0])!;
    const qty = i[14] > 0 ? i[14] * between(0.4, 1.8) : i[2] === "each" ? 200 : 1500;
    const expiryDays = i[13] === "frozen" ? 60 : i[13] === "ambient" ? 120 : Math.round(between(1, 7));
    const received = daysAgo(Math.round(between(1, 6)));
    const lotId = Number(insLot.run(id, supIds[["vegetables", "fruit", "herbs_spices"].includes(i[1]) ? 0 : ["meat", "poultry"].includes(i[1]) ? 1 : i[1] === "fish" ? 3 : 2], `B${lotN++}`, Math.round(qty), Math.round(qty), i[11], iso(received), iso(addDays(received, expiryDays)), i[13] === "frozen" ? "Freezer" : i[13] === "ambient" ? "Dry store" : "Walk-in fridge").lastInsertRowid);
    insTx.run(lotId, id, "purchase", Math.round(qty), `B${lotN}`, users.kitchen, iso(received));
    if (rnd() < 0.25) { const w = Math.round(qty * between(0.02, 0.08)); db.prepare("UPDATE inventory_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ?").run(w, lotId); insTx.run(lotId, id, "waste", -w, pick(["Spoiled", "Trim loss", "Dropped", "Past best-before"]), users.kitchen, iso(daysAgo(Math.round(between(0, 20))))); }
  }
  log("inventory");

  // ---- clients
  const insClient = db.prepare("INSERT INTO clients (user_id, first_name, last_name, email, phone, date_of_birth, gender, address, delivery_address, delivery_notes, status, source, registered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insHP = db.prepare("INSERT INTO client_health_profiles (client_id, height_cm, weight_kg, target_weight_kg, activity_level, fitness_level, blood_type, training_schedule, lifestyle, sleep_hours, water_litres, stress_level, is_pregnant, medical_conditions, eating_disorder_history, medically_restricted_diet) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insPref = db.prepare("INSERT INTO client_preferences (client_id, dietary_pattern, dietary_tags, cuisines, liked_foods, disliked_foods, meals_per_day, include_snacks, meal_times, people_served, cooking_preference, spice_level, budget_per_meal_zar, budget_per_week_zar, preferred_delivery_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insAll = db.prepare("INSERT INTO client_allergies (client_id, kind, allergen, severity) VALUES (?, ?, ?, ?)");
  const insGoal = db.prepare("INSERT INTO client_goals (client_id, goal_type, description, target_value, target_unit, target_date, is_primary) VALUES (?, ?, ?, ?, ?, ?, 1)");
  const insMeas = db.prepare("INSERT INTO client_measurements (client_id, measured_at, weight_kg, waist_cm, notes) VALUES (?, ?, ?, ?, ?)");
  const insConsent = db.prepare("INSERT INTO client_consents (client_id, consent_type, version, granted, granted_at) VALUES (?, ?, '2026-01', 1, ?)");
  const insProg = db.prepare("INSERT INTO client_progress (client_id, logged_at, weight_kg, waist_cm, adherence_pct, energy, satisfaction, water_litres, exercise_minutes, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

  const profiles = [
    { goal: "weight_management", pattern: "omnivore", tags: ["high_protein"], cuisines: ["Mediterranean", "Modern"], liked: ["chicken", "salmon"], disliked: ["mushrooms"], allergies: [] as [string, string, string][], h: 168, w: 82, tw: 72, act: "light", g: "female", age: 34, budget: 95, mpd: 3, snacks: 1, status: "active", sub: "balanced" },
    { goal: "muscle_gain", pattern: "omnivore", tags: ["high_protein"], cuisines: ["Asian", "Mexican"], liked: ["beef", "rice"], disliked: [], allergies: [], h: 181, w: 76, tw: 82, act: "very_active", g: "male", age: 27, budget: 120, mpd: 3, snacks: 1, status: "active", sub: "performance" },
    { goal: "healthy_eating", pattern: "vegetarian", tags: ["vegetarian"], cuisines: ["Indian", "Mediterranean"], liked: ["lentils", "chickpeas"], disliked: ["tofu"], allergies: [["allergy", "tree_nuts", "severe"]], h: 165, w: 61, tw: null, act: "moderate", g: "female", age: 41, budget: 85, mpd: 2, snacks: 1, status: "active", sub: "starter" },
    { goal: "sports_performance", pattern: "omnivore", tags: ["high_protein"], cuisines: ["Modern"], liked: ["salmon", "sweet potato", "oats"], disliked: ["lamb"], allergies: [["intolerance", "milk", "moderate"]], h: 175, w: 68, tw: null, act: "very_active", g: "female", age: 29, budget: 140, mpd: 3, snacks: 1, status: "active", sub: "complete" },
    { goal: "convenience", pattern: "omnivore", tags: [], cuisines: ["Italian", "Thai"], liked: ["pasta", "curry"], disliked: ["fish"], allergies: [], h: 178, w: 95, tw: 88, act: "sedentary", g: "male", age: 45, budget: 100, mpd: 2, snacks: 0, status: "active", sub: "balanced" },
    { goal: "vegan", pattern: "vegan", tags: ["vegan", "dairy_free"], cuisines: ["Asian", "Indian"], liked: ["tofu", "lentils"], disliked: [], allergies: [["allergy", "soy", "mild"]], h: 170, w: 58, tw: null, act: "moderate", g: "other", age: 23, budget: 80, mpd: 2, snacks: 1, status: "active", sub: null },
    { goal: "lower_carb", pattern: "omnivore", tags: ["lower_carb", "high_protein"], cuisines: ["Modern", "Mediterranean"], liked: ["eggs", "chicken"], disliked: ["rice"], allergies: [["allergy", "gluten", "moderate"]], h: 160, w: 71, tw: 64, act: "light", g: "female", age: 52, budget: 110, mpd: 3, snacks: 1, status: "active", sub: "balanced" },
    { goal: "high_protein", pattern: "omnivore", tags: ["high_protein"], cuisines: ["Mexican", "Modern"], liked: ["beef", "eggs"], disliked: ["cauliflower"], allergies: [], h: 185, w: 90, tw: 86, act: "active", g: "male", age: 31, budget: 110, mpd: 3, snacks: 1, status: "active", sub: "performance" },
    { goal: "weight_management", pattern: "pescatarian", tags: ["pescatarian"], cuisines: ["Mediterranean"], liked: ["tuna", "quinoa"], disliked: [], allergies: [["allergy", "crustaceans", "severe"]], h: 172, w: 88, tw: 78, act: "moderate", g: "female", age: 38, budget: 100, mpd: 2, snacks: 1, status: "active", sub: "starter" },
    { goal: "balanced", pattern: "halal", tags: ["halal"], cuisines: ["Middle Eastern", "Indian"], liked: ["chicken", "chickpeas"], disliked: ["pork"], allergies: [], h: 169, w: 74, tw: null, act: "moderate", g: "male", age: 36, budget: 95, mpd: 3, snacks: 0, status: "active", sub: "complete" },
    { goal: "weight_management", pattern: "omnivore", tags: [], cuisines: ["Modern"], liked: [], disliked: [], allergies: [], h: 163, w: 112, tw: 95, act: "sedentary", g: "female", age: 47, budget: 90, mpd: 3, snacks: 0, status: "onboarding", sub: null, medical: "Type 2 diabetes" },
    { goal: "muscle_gain", pattern: "omnivore", tags: ["high_protein"], cuisines: ["Asian"], liked: ["chicken", "rice"], disliked: [], allergies: [], h: 176, w: 64, tw: 70, act: "active", g: "male", age: 17, budget: 85, mpd: 3, snacks: 1, status: "onboarding", sub: null },
    { goal: "healthy_eating", pattern: "omnivore", tags: [], cuisines: ["Italian"], liked: ["pasta"], disliked: ["spinach"], allergies: [], h: 171, w: 69, tw: null, act: "light", g: "female", age: 33, budget: 90, mpd: 2, snacks: 1, status: "churned", sub: null },
    { goal: "convenience", pattern: "omnivore", tags: [], cuisines: ["Modern", "Thai"], liked: ["curry"], disliked: [], allergies: [], h: 180, w: 84, tw: null, act: "moderate", g: "male", age: 40, budget: 100, mpd: 2, snacks: 0, status: "paused", sub: null },
  ];

  const clientIds: number[] = [];
  const insClientUser = db.prepare("INSERT INTO users (email, password_hash, name, role, phone, is_demo) VALUES (?, ?, ?, 'client', ?, 1)");
  profiles.forEach((p, idx) => {
    const first = FIRST[idx], last = LAST[idx];
    const email = `${first.toLowerCase()}@client.local`;
    const uid = Number(insClientUser.run(email, hashPassword("client-demo"), `${first} ${last}`, "+27 83 100 00" + String(idx).padStart(2, "0")).lastInsertRowid);
    const regDays = idx < 10 ? Math.round(between(30, 100)) : idx < 12 ? Math.round(between(1, 5)) : Math.round(between(60, 110));
    const dob = new Date(today); dob.setFullYear(dob.getFullYear() - p.age); dob.setMonth(Math.floor(rnd() * 12));
    const addr = `${Math.floor(between(1, 200))} ${pick(["Oak", "Jan Smuts", "7th", "Main", "Rivonia", "Barry Hertzog"])} Ave, ${pick(SUBURBS)}`;
    const cid = Number(insClient.run(uid, first, last, email, "+27 83 100 00" + String(idx).padStart(2, "0"), iso(dob), p.g, addr, addr, pick(["", "Gate code 1234", "Leave with security", "Ring the bell twice"]), p.status, pick(["instagram", "referral", "google", "facebook", "whatsapp", "tiktok"]), iso(daysAgo(regDays))).lastInsertRowid);
    clientIds.push(cid);
    insHP.run(cid, p.h, p.w, p.tw, p.act, pick(["beginner", "intermediate", "advanced"]), pick(["", "O+", "A+", "B+", "AB-"]), pick(["", "Gym Mon/Wed/Fri 06:00", "Runs Tue/Thu, long run Sat", "CrossFit 5× week"]), pick(["Office-based", "Hybrid", "Shift work", "Student"]), Math.round(between(5.5, 8.5) * 2) / 2, Math.round(between(1, 3) * 2) / 2, pick(["low", "medium", "high"]), 0, (p as { medical?: string }).medical ?? "", 0, "");
    insPref.run(cid, p.pattern, JSON.stringify(p.tags), JSON.stringify(p.cuisines), JSON.stringify(p.liked), JSON.stringify(p.disliked), p.mpd, p.snacks, JSON.stringify({ breakfast: "07:00", lunch: "12:30", dinner: "19:00" }), idx === 4 ? 2 : 1, "ready_to_heat", pick(["mild", "medium", "hot"]), p.budget, p.budget * p.mpd * 5, JSON.stringify(["mon", "thu"]));
    for (const [kind, allergen, sev] of p.allergies) insAll.run(cid, kind, allergen, sev);
    insGoal.run(cid, p.goal, "", p.tw, p.tw ? "kg" : "", p.tw ? iso(addDays(today, 90)) : null);
    for (const t of ["data_processing", "health_data", "terms", "marketing"]) insConsent.run(cid, t, iso(daysAgo(regDays)));
    // measurements + progress
    const weeks = Math.min(12, Math.floor(regDays / 7));
    let w = p.w + (p.tw && p.tw < p.w ? weeks * 0.35 : p.tw && p.tw > p.w ? -weeks * 0.2 : 0);
    for (let k = weeks; k >= 0; k--) {
      const d = iso(daysAgo(k * 7));
      insMeas.run(cid, d, Math.round(w * 10) / 10, Math.round(between(70, 100)), k === weeks ? "Onboarding" : "Weekly check-in");
      if (k < weeks && p.status === "active") insProg.run(cid, d, Math.round(w * 10) / 10, Math.round(between(70, 100)), Math.round(between(60, 100)), Math.round(between(2, 5)), Math.round(between(3, 5)), Math.round(between(1, 3) * 2) / 2, Math.round(between(0, 240)), "");
      w += p.tw && p.tw < p.w ? -0.35 + between(-0.2, 0.2) : p.tw && p.tw > p.w ? 0.2 + between(-0.1, 0.1) : between(-0.3, 0.3);
    }
  });
  log("clients");

  // ---- subscriptions
  const insSub = db.prepare("INSERT INTO subscriptions (client_id, package_id, meals_per_week, frequency, price_per_cycle, start_date, renewal_date, status, meals_remaining, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insSubEv = db.prepare("INSERT INTO subscription_events (subscription_id, event_type, week_start, created_at) VALUES (?, ?, ?, ?)");
  const subByClient = new Map<number, number>();
  profiles.forEach((p, idx) => {
    if (!p.sub) return;
    const pk = db.prepare("SELECT * FROM packages WHERE id = ?").get(pkg[p.sub]) as { id: number; meals_per_week: number; price_zar: number };
    const freq = pick(["weekly", "weekly", "biweekly", "monthly"]);
    const start = iso(daysAgo(Math.round(between(20, 80))));
    const renewal = iso(addDays(today, Math.round(between(-1, 12))));
    const sid = Number(insSub.run(clientIds[idx], pk.id, pk.meals_per_week, freq, pk.price_zar * (freq === "monthly" ? 4 : freq === "biweekly" ? 2 : 1), start, renewal, "active", pk.meals_per_week, start).lastInsertRowid);
    subByClient.set(clientIds[idx], sid);
    insSubEv.run(sid, "renewed", null, start);
    if (rnd() < 0.4) insSubEv.run(sid, "skipped", iso(monday(daysAgo(21))), iso(daysAgo(24)));
  });

  // ---- plans, orders, payments, deliveries, feedback (12 weeks of history)
  const mealsByCat = (cat: string) => MEALS.filter((m) => m.category === cat).map((m) => mealByName.get(m.name)!);
  const mealPrice = new Map(MEALS.map((m) => [mealByName.get(m.name)!, m.price]));
  const mealCostApprox = new Map(MEALS.map((m) => [mealByName.get(m.name)!, Math.round(m.price * between(0.38, 0.5) * 100) / 100]));
  const insPlan = db.prepare("INSERT INTO meal_plans (client_id, week_start, status, goal_type, meals_per_day, include_snacks, budget_zar, created_by, approved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insPlanItem = db.prepare("INSERT INTO meal_plan_items (plan_id, day_index, slot, meal_id, portion_multiplier, reasons_json) VALUES (?, ?, ?, ?, 1, ?)");
  const insOrder = db.prepare("INSERT INTO orders (order_number, client_id, meal_plan_id, subscription_id, package_id, location_id, status, delivery_date, delivery_address, people_served, subtotal_zar, discount_zar, delivery_fee_zar, total_zar, payment_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insItem = db.prepare("INSERT INTO order_items (order_id, meal_id, meal_number, day_index, slot, quantity, portion_multiplier, unit_price_zar, unit_cost_zar, status) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)");
  const insPay = db.prepare("INSERT INTO payments (order_id, client_id, subscription_id, amount_zar, method, reference, status, paid_at) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)");
  const insDel = db.prepare("INSERT INTO deliveries (order_id, client_id, driver_id, delivery_date, window_start, window_end, address, status, proof_type, proof_note, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insFb = db.prepare("INSERT INTO feedback (client_id, order_id, meal_id, taste, portion, presentation, variety, packaging, overall, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insBatch = db.prepare("INSERT INTO production_batches (production_date, meal_id, location_id, quantity_required, quantity_done, quantity_wasted, status, assigned_user_id, started_at, completed_at) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)");
  const insPI = db.prepare("INSERT INTO production_items (batch_id, order_item_id) VALUES (?, ?)");
  const insLabel = db.prepare("INSERT INTO meal_labels (order_item_id, token, prepared_on, best_before, printed_at) VALUES (?, ?, ?, ?, ?)");
  const insComm = db.prepare("INSERT INTO communications (client_id, channel, template, subject, body, status, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const comments = ["Loved the curry — perfect spice level.", "Portions were generous.", "Salmon was a little dry this week.", "Packaging looked premium, labels very clear.", "More variety on breakfasts please.", "The pasta bake is my favourite.", "Could use less salt.", "Delivered right on time, thank you!", ""];

  let orderN = 1;
  const thisMonday = monday(today);
  const batches = new Map<string, number>();
  const ratingFloor = new Map<number, number>(mealIds.map((id) => [id, between(3.2, 4.8)]));

  profiles.forEach((p, idx) => {
    const cid = clientIds[idx];
    if (!["active", "paused", "churned"].includes(p.status)) return;
    const weeksBack = p.status === "churned" ? [12, 11, 10, 9] : [10, 9, 8, 7, 6];
    const cadence = p.sub ? 1 : 2;
    const slots: string[] = []; if (p.mpd >= 3) slots.push("breakfast", "lunch"); else if (p.mpd === 2) slots.push("lunch"); if (p.snacks) slots.push("snack"); slots.push("dinner");
    const mealsPerWeekLimit = p.sub ? (db.prepare("SELECT meals_per_week FROM packages WHERE id = ?").get(pkg[p.sub]) as { meals_per_week: number }).meals_per_week : 10;
    const weeks = p.status === "active" ? [-1, ...Array(13).keys()] : weeksBack;
    const dayOffset = [0, 1, 3, 4][idx % 4]; // Mon / Tue / Thu / Fri delivery
    for (const k of weeks) {
      if (k > 0 && k % cadence !== 0) continue;
      if (k > 0 && rnd() < 0.12) continue; // skipped week
      const deliveryDate = addDays(thisMonday, -7 * k + dayOffset);
      const ws = iso(monday(deliveryDate));
      const createdAt = addDays(deliveryDate, -4);
      const future = deliveryDate > today;
      const isToday = iso(deliveryDate) === iso(today);
      const daysUntil = Math.round((deliveryDate.getTime() - today.getTime()) / 86400000);
      const planStatus = future ? pick(["proposed", "approved", "ordered", "ordered"]) : "ordered";
      const planId = Number(insPlan.run(cid, ws, planStatus, p.goal, p.mpd, p.snacks, p.budget * p.mpd * 5, users.planner, planStatus === "draft" || planStatus === "proposed" ? null : iso(createdAt), iso(addDays(createdAt, -1))).lastInsertRowid);
      // plan items honoring simple pattern/allergy rules
      const okMeal = (mid: number) => {
        const def = MEALS.find((m) => mealByName.get(m.name) === mid)!;
        if (p.pattern === "vegan" && !def.tags.includes("vegan")) return false;
        if (p.pattern === "vegetarian" && !def.tags.includes("vegetarian") && !def.tags.includes("vegan")) return false;
        if (p.pattern === "pescatarian" && !(def.tags.includes("pescatarian") || def.tags.includes("vegetarian") || def.tags.includes("vegan"))) return false;
        for (const [, a] of p.allergies) { const ings = def.lines.map(([n]) => INGREDIENTS.find((i) => i[0] === n)!); if (ings.some((i) => i[10].includes(a))) return false; }
        if (p.disliked.some((d) => def.lines.some(([n]) => n.toLowerCase().includes(d)) || def.name.toLowerCase().includes(d))) return false;
        return true;
      };
      const items: { day: number; slot: string; meal: number }[] = [];
      let count = 0;
      for (let d = 0; d < 7 && count < mealsPerWeekLimit; d++) for (const s of slots) {
        if (count >= mealsPerWeekLimit) break;
        const pool = (s === "snack" ? [...mealsByCat("snack"), ...mealsByCat("dessert"), ...mealsByCat("drink")] : mealsByCat(s)).filter(okMeal);
        if (!pool.length) continue;
        const prev = items.filter((i) => i.day === d - 1 && i.slot === s)[0]?.meal;
        let m = pick(pool); if (pool.length > 1 && m === prev) m = pick(pool.filter((x) => x !== prev));
        items.push({ day: d, slot: s, meal: m }); count++;
      }
      for (const it of items) insPlanItem.run(planId, it.day, it.slot, it.meal, JSON.stringify(["Fits the client's targets and preferences.", "Suitable for meal prep."]));
      if (planStatus === "proposed") { insComm.run(cid, "whatsapp", "meal_plan_ready", "Your meal plan is ready", `Hi ${p ? FIRST[idx] : ""}, your meal plan for the week of ${ws} is ready.`, "queued", iso(createdAt), null); continue; }
      if (planStatus === "approved" && rnd() < 0.5) continue;
      // order
      const people = idx === 4 ? 2 : 1;
      const subtotal = items.reduce((s, i) => s + mealPrice.get(i.meal)! * people, 0);
      const discount = p.sub ? Math.round(subtotal * (mealsPerWeekLimit >= 21 ? 0.12 : mealsPerWeekLimit >= 14 ? 0.08 : mealsPerWeekLimit >= 10 ? 0.05 : 0)) : 0;
      const fee = 35;
      const total = subtotal - discount + fee;
      let status: string, payStatus: string;
      if (isToday) { status = pick(["ready", "out_for_delivery", "out_for_delivery", "delivered"]); payStatus = "paid"; }
      else if (!future) { status = pick(["delivered", "delivered", "completed"]); payStatus = "paid"; }
      else if (daysUntil <= 1) { status = pick(["preparing", "packaging", "ready"]); payStatus = "paid"; }
      else if (daysUntil <= 3) { status = pick(["paid", "plan_created", "shopping", "awaiting_payment"]); payStatus = status === "awaiting_payment" ? "unpaid" : "paid"; }
      else { status = pick(["awaiting_payment", "paid", "quote_sent"]); payStatus = status === "paid" ? "paid" : "unpaid"; }
      const orderId = Number(insOrder.run(`ORD-2026-${String(orderN++).padStart(4, "0")}`, cid, planId, subByClient.get(cid) ?? null, p.sub ? pkg[p.sub] : null, status, iso(deliveryDate), db.prepare("SELECT delivery_address FROM clients WHERE id = ?").pluck().get(cid), people, subtotal, discount, fee, total, payStatus, iso(createdAt), iso(createdAt)).lastInsertRowid);
      insComm.run(cid, "email", "order_confirmation", `Order confirmed`, `Your order totalling R${total} is confirmed.`, "sent", iso(createdAt), iso(createdAt));
      const itemStatus = status === "delivered" || status === "completed" ? "delivered" : ["ready", "out_for_delivery"].includes(status) ? "ready" : ["preparing", "packaging"].includes(status) ? "in_production" : "pending";
      const itemIds: { id: number; meal: number }[] = [];
      items.forEach((it, n) => { itemIds.push({ id: Number(insItem.run(orderId, it.meal, n + 1, it.day, it.slot, people, mealPrice.get(it.meal)!, mealCostApprox.get(it.meal)!, itemStatus).lastInsertRowid), meal: it.meal }); });
      if (payStatus === "paid") insPay.run(orderId, cid, subByClient.get(cid) ?? null, total, pick(["eft", "card", "payfast", "eft"]), `PAY${orderN}${Math.floor(rnd() * 9000 + 1000)}`, iso(addDays(createdAt, 1) > today ? today : addDays(createdAt, 1)) + "T" + String(8 + Math.floor(rnd() * 10)).padStart(2, "0") + ":15:00");
      else if (status === "awaiting_payment") insComm.run(cid, "whatsapp", "payment_reminder", "Payment reminder", `Order is awaiting payment (R${total}).`, "queued", iso(addDays(createdAt, 1)), null);
      // production batches (paid orders)
      if (payStatus === "paid" && status !== "quote_sent") {
        const prodDate = iso(addDays(deliveryDate, -1));
        const bStatus = isToday ? (status === "delivered" ? "delivered" : "ready") : !future ? "delivered" : daysUntil <= 1 ? (status === "ready" ? "ready" : status === "packaging" ? "packaging" : pick(["preparing", "cooking", "portioning"])) : "not_started";
        for (const it of itemIds) {
          const key = `${prodDate}:${it.meal}`;
          let bid = batches.get(key);
          if (!bid) { bid = Number(insBatch.run(prodDate, it.meal, 0, 0, 0, bStatus, bStatus === "not_started" ? null : users.kitchen, bStatus === "not_started" ? null : prodDate + "T06:30:00", ["ready", "delivered"].includes(bStatus) ? prodDate + "T14:00:00" : null).lastInsertRowid); batches.set(key, bid); }
          db.prepare("UPDATE production_batches SET quantity_required = quantity_required + ?, quantity_done = CASE WHEN status IN ('ready','delivered') THEN quantity_required + ? ELSE quantity_done END WHERE id = ?").run(people, people, bid);
          insPI.run(bid, it.id);
          if (["ready", "delivered", "packaging"].includes(bStatus)) insLabel.run(it.id, `${orderId}-${it.id}-${Math.floor(rnd() * 1e6).toString(36)}`, prodDate, iso(addDays(new Date(prodDate + "T00:00:00"), MEALS.find((m) => mealByName.get(m.name) === it.meal)!.shelf)), prodDate + "T13:00:00");
        }
        // delivery
        const dStatus = isToday ? (status === "delivered" ? "delivered" : status === "out_for_delivery" ? "out_for_delivery" : "assigned") : !future ? (rnd() < 0.04 ? "failed" : "delivered") : daysUntil <= 3 ? "assigned" : "pending";
        insDel.run(orderId, cid, dStatus === "pending" ? null : users.delivery, iso(deliveryDate), pick(["07:00", "08:00", "09:00"]), pick(["11:00", "12:00", "13:00"]), db.prepare("SELECT delivery_address FROM clients WHERE id = ?").pluck().get(cid), dStatus, dStatus === "delivered" ? pick(["photo", "signature", "pin"]) : "", dStatus === "delivered" ? pick(["Left with client", "Handed to security", "Signed by client"]) : "", dStatus === "delivered" ? iso(deliveryDate) + "T09:40:00" : null);
        if (dStatus === "delivered") { insComm.run(cid, "whatsapp", "delivered", "Delivered", "Your meals have been delivered.", "sent", iso(deliveryDate), iso(deliveryDate)); insComm.run(cid, "whatsapp", "feedback_request", "How were your meals?", "We'd love your feedback.", "sent", iso(deliveryDate), iso(deliveryDate)); }
        // feedback
        if (dStatus === "delivered" && rnd() < 0.7) {
          const rated = itemIds.filter(() => rnd() < 0.35).slice(0, 4);
          for (const it of rated.length ? rated : [itemIds[0]]) {
            const base = ratingFloor.get(it.meal)!;
            const r = () => Math.max(1, Math.min(5, Math.round(base + between(-0.9, 0.9))));
            insFb.run(cid, orderId, it.meal, r(), r(), r(), r(), r(), Math.max(1, Math.min(5, Math.round(base + between(-0.6, 0.6)))), pick(comments), iso(addDays(deliveryDate, 1)));
          }
        }
      }
    }
  });
  // production batch wastage touch-ups
  for (const bid of batches.values()) if (rnd() < 0.15) db.prepare("UPDATE production_batches SET quantity_wasted = ? WHERE id = ? AND status = 'delivered'").run(1 + Math.floor(rnd() * 2), bid);
  log("orders");

  // ---- expenses (recurring + ad hoc, 4 months)
  const insExp = db.prepare("INSERT INTO expenses (category, description, amount_zar, incurred_at, is_recurring) VALUES (?, ?, ?, ?, ?)");
  for (let m = 3; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const di = iso(d);
    insExp.run("rent", "Shared commercial kitchen rental", 6500, di, 1);
    insExp.run("utilities", "Electricity, water, gas", Math.round(between(2200, 3400)), di, 1);
    insExp.run("labour", "Kitchen & packing wages (part-time)", Math.round(between(9000, 12000)), di, 1);
    insExp.run("software", "Platform, accounting, messaging", 1450, di, 1);
    insExp.run("insurance", "Public liability & stock", 850, di, 1);
    insExp.run("delivery", "Fuel & driver", Math.round(between(3200, 4800)), iso(addDays(d, 10)), 0);
    insExp.run("marketing", pick(["Instagram ads", "Flyers at gyms", "Referral rewards"]), Math.round(between(1500, 4000)), iso(addDays(d, 12)), 0);
    insExp.run("packaging", "Containers, labels, sleeves", Math.round(between(2800, 4200)), iso(addDays(d, 5)), 0);
    if (m === 2) insExp.run("equipment", "Vacuum sealer", 3200, iso(addDays(d, 18)), 0);
  }
  log("expenses");

  // ---- marketing campaigns
  const insCamp = db.prepare("INSERT INTO marketing_campaigns (name, channel, start_date, end_date, spend_zar, leads, conversions, orders, revenue_zar, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  insCamp.run("5-Day Healthy Reset", "instagram", iso(daysAgo(45)), iso(daysAgo(15)), 2400, 38, 6, 11, 6150, "completed", "Reels + story ads");
  insCamp.run("High Protein Week", "tiktok", iso(daysAgo(20)), null, 1800, 52, 5, 7, 5600, "active", "Creator collaboration");
  insCamp.run("Office Lunch Subscription", "email", iso(daysAgo(30)), null, 400, 14, 3, 9, 8100, "active", "Outreach to 3 office parks");
  insCamp.run("Referral rewards", "whatsapp", iso(daysAgo(60)), null, 900, 21, 9, 24, 19800, "active", "R100 credit per referral");
  insCamp.run("Google search", "google", iso(daysAgo(40)), null, 2200, 29, 4, 6, 4900, "active", "Branded + 'meal prep johannesburg'");

  // ---- startup costs & compliance
  const insSC = db.prepare("INSERT INTO startup_cost_items (category, description, estimate_zar, actual_zar, is_recurring, sort_order) VALUES (?, ?, ?, ?, ?, ?)");
  STARTUP_COST_DEFAULTS.forEach((s, i) => insSC.run(s.category, s.description, s.estimate, rnd() < 0.5 ? Math.round(s.estimate * between(0.85, 1.2)) : null, s.recurring ? 1 : 0, i));
  const insCI = db.prepare("INSERT INTO compliance_items (area, requirement, guidance, status, sort_order) VALUES (?, ?, ?, ?, ?)");
  COMPLIANCE_DEFAULTS.forEach((c, i) => insCI.run(c.area, c.requirement, c.guidance, pick(["done", "in_progress", "todo", "done"]), i));

  // ---- audit log sample
  db.prepare("INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at) VALUES (?, 'seed', 'database', NULL, 'Demo data generated', ?)").run(users.admin, iso(today) + "T07:00:00");
  log("done");
  return { users, clientIds, mealIds };
}

export function wipeDemo(db: Database.Database) {
  const tables = ["audit_log", "automation_events", "communications", "notifications", "client_progress", "feedback", "deliveries", "delivery_routes", "meal_labels",
    "production_items", "production_batches", "packaging_items", "inventory_transactions", "inventory_lots", "purchase_order_lines", "purchase_orders", "expenses", "payments",
    "order_items", "orders", "subscription_events", "subscriptions", "packages", "meal_plan_items", "meal_plans", "recipe_ingredients", "recipes", "meals",
    "supplier_price_history", "supplier_products", "suppliers", "ingredients", "client_consents", "professional_reviews", "client_nutrition_targets", "client_measurements",
    "client_allergies", "client_preferences", "client_goals", "client_health_profiles", "clients", "marketing_campaigns", "startup_cost_items", "compliance_items", "sessions", "users"];
  db.transaction(() => { for (const t of tables) db.exec(`DELETE FROM ${t}`); db.exec("DELETE FROM sqlite_sequence"); })();
}
