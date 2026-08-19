import { seedDemoData, wipeDemoData } from "../lib/seed-core";

async function main() {
  await wipeDemoData();
  await seedDemoData();
  console.log("Demo data seeded. Log in with khethiwe / khethiwe-demo (or lethabo / aldonia).");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
