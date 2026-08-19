import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // This app is a self-contained project inside a larger repo; without this,
  // Next infers the parent directory as the workspace root (there is a lockfile
  // there too) and traces the wrong files when building for deployment.
  outputFileTracingRoot: path.join(__dirname),
  // libsql ships native binaries for local file access. Leave it to Node's
  // resolver instead of letting the bundler try to inline a .node file.
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // Uploaded timetable images/PDFs are posted through a server action.
    // Kept under Vercel's 4.5 MB request-body ceiling.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
