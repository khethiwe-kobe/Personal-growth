import type { NextConfig } from "next";

// DEPLOY_TARGET=pages produces a fully static export served from
// https://<user>.github.io/Personal-growth/ (see README).
const isPages = process.env.DEPLOY_TARGET === "pages";

const nextConfig: NextConfig = {
  ...(isPages
    ? {
        output: "export" as const,
        basePath: "/Personal-growth",
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
