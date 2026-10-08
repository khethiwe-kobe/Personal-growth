import { test } from "node:test";
import assert from "node:assert/strict";
import { breakEven } from "../lib/finance";
import { render } from "../lib/comms";
import { verifyPassword, hashPassword, can, PERMISSIONS } from "../lib/auth";

test("break-even matches the brief's example", () => {
  const r = breakEven(20000, 100, 50, 20);
  assert.equal(r.contribution, 50);
  assert.equal(r.meals, 400);
  assert.equal(r.clients, 20);
  assert.equal(r.revenue, 40000);
  assert.equal(breakEven(20000, 50, 50).meals, Infinity);
});

test("message templates render variables", () => {
  assert.equal(render("Hi {{first_name}}, order {{order}} is R{{total}}", { first_name: "Thandiwe", order: "ORD-1", total: "950" }), "Hi Thandiwe, order ORD-1 is R950");
});

test("passwords hash and verify; roles map to permissions", () => {
  const h = hashPassword("secret-pass");
  assert.ok(verifyPassword("secret-pass", h));
  assert.ok(!verifyPassword("wrong", h));
  const kitchen = { id: 1, email: "k", name: "k", role: "kitchen" as const, client_id: null };
  assert.ok(can(kitchen, "production:edit"));
  assert.ok(!can(kitchen, "finance:view"));
  assert.ok(!can({ ...kitchen, role: "client" }, "clients:view"));
  assert.ok(PERMISSIONS.admin.includes("audit:view"));
});
