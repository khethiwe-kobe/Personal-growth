import type { NextConfig } from "next";

// DEPLOY_TARGET=pages produces a fully static export served from
// https://<user>.github.io/Personal-growth/ (see README).
const isPages = process.env.DEPLOY_TARGET === "pages";

const nextConfig: NextConfig = {
  // Route handlers live in files ending `.api.ts` (e.g. app/api/reamaze/
  // route.api.ts). They need a Node server, so they're only registered as
  // routes for server builds. The static Pages export omits the `.api.ts`
  // extension, dropping those routes so `output: export` can succeed.
  pageExtensions: isPages
    ? ["tsx", "ts", "jsx", "js"]
    : ["tsx", "ts", "jsx", "js", "api.ts", "api.tsx"],
  ...(isPages
    ? {
        output: "export" as const,
        basePath: "/Personal-growth",
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
