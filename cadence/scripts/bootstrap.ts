/**
 * Opens (and if necessary creates + migrates) the database, then prints the
 * invite code of the first accountability group. Safe to run repeatedly.
 */
import { all, get } from "../lib/db";

async function main() {
  const groups = await all<{ name: string; invite_code: string }>(
    "SELECT name, invite_code FROM groups ORDER BY id"
  );
  const users = await get<{ n: number }>("SELECT COUNT(*) AS n FROM users");

  console.log(`Database ready. ${users?.n ?? 0} user(s), ${groups.length} group(s).`);
  for (const g of groups) console.log(`  ${g.name} — invite code: ${g.invite_code}`);
  console.log("\nCreate the first account at /join using the invite code above.");
}

main().catch((err) => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
