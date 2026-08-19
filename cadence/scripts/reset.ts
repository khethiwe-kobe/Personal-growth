import { wipeDemoData } from "../lib/seed-core";

wipeDemoData()
  .then(() => console.log("Demo data removed."))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
