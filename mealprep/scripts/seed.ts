import { getDb, closeDb } from "../lib/db";
import { seedDemo, wipeDemo } from "../lib/seed-core";

async function main() {
  const db = getDb();
  const existing = (await db.prepare("SELECT COUNT(*) AS n FROM ingredients").get()) as { n: number };
  if (existing.n > 0) {
    if (process.argv.includes("--force")) { console.log("Wiping existing data…"); await wipeDemo(db); }
    else { console.log("Database already has data. Run `npm run seed -- --force` to wipe it and load the demo business."); return; }
  }
  const r = await seedDemo(db, { verbose: true });
  console.log(`Seeded ${r.clients} clients, ${r.meals} meals.`);
  console.log("Logins (password = <role>-demo): owner@demo.local / admin-demo, planner@demo.local / planner-demo, kitchen@demo.local / kitchen-demo, packaging@demo.local / packaging-demo, driver@demo.local / delivery-demo, accounts@demo.local / accounting-demo");
  console.log("Client portal: thandiwe@client.local / client-demo (any seeded client, password client-demo)");
}

main().then(closeDb, async (e) => { console.error(e); await closeDb(); process.exit(1); });
