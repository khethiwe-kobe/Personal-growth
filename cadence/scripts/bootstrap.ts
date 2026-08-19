/**
 * Opens (and if necessary creates + migrates) the database, then prints the
 * invite code of the first accountability group. Safe to run repeatedly.
 */
import { getDb } from "../lib/db";

const db = getDb();
const groups = db
  .prepare("SELECT name, invite_code FROM groups ORDER BY id")
  .all() as { name: string; invite_code: string }[];
const users = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };

console.log(`Database ready. ${users.n} user(s), ${groups.length} group(s).`);
for (const g of groups) console.log(`  ${g.name} — invite code: ${g.invite_code}`);
console.log("\nCreate the first account at /join using the invite code above.");
