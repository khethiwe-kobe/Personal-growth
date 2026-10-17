import { getDb, closeDb } from "../lib/db";
import { wipeDemo } from "../lib/seed-core";

wipeDemo(getDb())
  .then(() => console.log("All data removed."))
  .then(closeDb, async (e) => { console.error(e); await closeDb(); process.exit(1); });
