import path from "node:path";
import type { NextConfig } from "next";

// rd-coach lives inside a repo with its own lockfile at the top level; pin the
// root to this folder so builds and file tracing only consider this app.
const root = path.join(__dirname);

const nextConfig: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
  // In-process Postgres for local development and tests only; never bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
