import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, publicMenu, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  return [...PUBLIC_PATHS.map((p) => ({ url: `${base}${p === "/" ? "" : p}` })), ...(await publicMenu()).map((m) => ({ url: `${base}/menu/${m.id}` }))];
}
