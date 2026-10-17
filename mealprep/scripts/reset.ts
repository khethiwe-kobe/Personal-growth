import { getDb } from "../lib/db";
import { wipeDemo } from "../lib/seed-core";
wipeDemo(getDb());
console.log("All data removed.");
