import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTargets, bmi, mifflinStJeor, mealDistribution, ageFromDob } from "../lib/nutrition";

const base = { gender: "female" as const, age: 34, height_cm: 168, weight_kg: 82, activity_level: "light" as const, goal: "weight_management" };

test("BMI and Mifflin-St Jeor", () => {
  assert.equal(bmi(168, 82), 29.1);
  assert.equal(Math.round(mifflinStJeor(82, 168, 34, "female")), 10 * 82 + 6.25 * 168 - 5 * 34 - 161);
  assert.equal(Math.round(mifflinStJeor(82, 168, 34, "male")), 10 * 82 + 6.25 * 168 - 5 * 34 + 5);
});

test("weight management applies a capped 15% deficit and never below the floor", () => {
  const t = computeTargets(base);
  assert.equal(t.bmr, 1539);
  assert.equal(t.tdee, Math.round(1539 * 1.375));
  assert.equal(t.calories_target, Math.round(t.tdee! * 0.85));
  assert.ok(t.calories_target! >= 1200);
  assert.equal(t.requires_professional_review, false);
  const tiny = computeTargets({ ...base, weight_kg: 45, height_cm: 150, age: 60, activity_level: "sedentary" });
  assert.equal(tiny.calories_target, 1200);
  assert.ok(tiny.flags.some((f) => f.code === "calorie_floor"));
});

test("safety flags trigger professional review and suppress deficits", () => {
  const preg = computeTargets({ ...base, is_pregnant: true });
  assert.ok(preg.requires_professional_review);
  assert.equal(preg.calories_target, preg.tdee);
  const minor = computeTargets({ ...base, age: 16 });
  assert.ok(minor.flags.some((f) => f.code === "under_18"));
  const lowBmi = computeTargets({ ...base, weight_kg: 50 });
  assert.ok(lowBmi.flags.some((f) => f.code === "bmi_low"));
  assert.equal(lowBmi.calories_target, lowBmi.tdee);
  const med = computeTargets({ ...base, medical_conditions: "Type 2 diabetes" });
  assert.ok(med.requires_professional_review);
  const severe = computeTargets({ ...base, allergies: [{ kind: "allergy", severity: "severe", allergen: "peanuts" }] });
  assert.ok(severe.flags.some((f) => f.code === "severe_allergy"));
  const ed = computeTargets({ ...base, eating_disorder_history: true });
  assert.ok(ed.requires_professional_review);
});

test("protein scales with goal and is capped at 35% of energy", () => {
  const gain = computeTargets({ ...base, goal: "muscle_gain", gender: "male", weight_kg: 76, activity_level: "very_active" });
  assert.equal(gain.protein_g, Math.round(1.8 * 76));
  assert.ok(gain.protein_g! * 4 <= gain.calories_target! * 0.35 + 4);
  assert.ok(gain.calories_target! > gain.tdee!);
});

test("meal distribution sums to 100%", () => {
  for (const [m, s] of [[3, true], [3, false], [2, true], [1, false]] as const) {
    const d = mealDistribution(m, s, 2000);
    assert.ok(Math.abs(d.reduce((a, x) => a + x.share, 0) - 1) < 1e-9);
  }
});

test("age from date of birth", () => {
  assert.equal(ageFromDob("2000-01-15", new Date("2026-01-14")), 25);
  assert.equal(ageFromDob("2000-01-15", new Date("2026-01-15")), 26);
  assert.equal(ageFromDob(null), null);
});
