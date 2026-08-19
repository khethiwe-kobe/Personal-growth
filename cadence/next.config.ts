import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // This app is a self-contained project inside a larger repo; without this,
  // Next infers the parent directory as the workspace root (there is a lockfile
  // there too) and traces the wrong files when building for deployment.
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Uploaded timetable images/PDFs are posted to a route handler.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
