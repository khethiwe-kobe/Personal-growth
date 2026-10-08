import { getDb } from "../lib/db";
import { seed, wipeDemo } from "../lib/seed-core";
import { recomputeTargets } from "../lib/repo/clients";

const db = getDb();
const existing = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
if (existing.n > 0) {
  if (process.argv.includes("--force")) { console.log("Wiping existing data…"); wipeDemo(db); }
  else { console.log("Database already has data. Run `npm run seed -- --force` to wipe and reseed."); process.exit(0); }
}
const r = seed(db, { verbose: true });
for (const id of r.clientIds) recomputeTargets(id);
console.log(`Seeded ${r.clientIds.length} clients, ${r.mealIds.length} meals.`);
console.log("Logins (password = <role>-demo): owner@demo.local / admin-demo, planner@demo.local / planner-demo, kitchen@demo.local / kitchen-demo, packaging@demo.local / packaging-demo, driver@demo.local / delivery-demo, accounts@demo.local / accounting-demo");
console.log("Client portal: thandiwe@client.local / client-demo (any seeded client, password client-demo)");
