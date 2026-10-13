import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The coach route streams long responses; keep the SDK external so
  // Node's native fetch/stream handling is used unchanged.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
