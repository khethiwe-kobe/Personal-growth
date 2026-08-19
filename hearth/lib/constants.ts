export const GROCERY_CATEGORIES = [
  "Meat",
  "Vegetables",
  "Fruit",
  "Dairy",
  "Pantry",
  "Snacks",
  "Drinks",
  "Cleaning",
  "Household",
  "Other",
] as const;

export const TRANSPORT_TYPES = [
  "Uber",
  "Bolt",
  "Petrol",
  "Public transport",
  "Other",
] as const;

export const MEAL_CATEGORIES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "Dessert",
] as const;

export const BUSINESS_EXPENSE_TYPES = [
  "Ingredients",
  "Packaging",
  "Transport",
  "Equipment",
  "Marketing",
  "Other",
] as const;

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;

// keyword -> category suggestions for bank statement imports
export const IMPORT_CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/checkers|shoprite|pick n pay|pnp|woolworths|spar|food lover|boxer/i, "Groceries"],
  [/uber|bolt|taxify|gautrain|taxi|petrol|engen|shell|sasol|bp |total/i, "Transport"],
  [/eskom|electricity|prepaid|power/i, "Electricity"],
  [/rent|landlord|lease/i, "Rent"],
  [/salary|wage|income|deposit/i, "Other income"],
  [/restaurant|kfc|nando|mcd|steers|debonairs|romans|pizza|chicken licken/i, "Eating out"],
];

export function suggestCategory(description: string): string {
  for (const [re, cat] of IMPORT_CATEGORY_HINTS) {
    if (re.test(description)) return cat;
  }
  return "Other";
}
