/**
 * Writes a full JSON snapshot of the database to ./backups/.
 * Works against the local file or your Turso database, depending on env:
 *
 *   npm run backup                                  # local ./data/cadence.db
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run backup   # the live one
 */
import fs from "fs";
import path from "path";
import { snapshot, countRows } from "../lib/backup";

async function main() {
  const snap = await snapshot();
  const dir = path.join(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `cadence-${snap.exported_at.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(snap, null, 2));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`Snapshot written: ${file} (${countRows(snap)} rows, ${kb} KB)`);
  for (const [t, rows] of Object.entries(snap.tables))
    if (rows.length) console.log(`  ${t}: ${rows.length}`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
