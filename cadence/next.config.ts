import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Uploaded timetable images/PDFs are posted to a route handler.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
