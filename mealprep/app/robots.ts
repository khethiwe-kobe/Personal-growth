import type { MetadataRoute } from "next";
import { PUBLIC_PATHS, siteUrl } from "@/lib/site";

/** Only the marketing pages are indexable; the business system and client portal are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: [...PUBLIC_PATHS.map((p) => (p === "/" ? "/$" : p)), "/menu/"], disallow: "/" },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
