import type { MetadataRoute } from "next";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces: no value in a search result, and every one of them
        // is either gated or a duplicate of the feed.
        disallow: ["/api/", "/mod", "/profile", "/login", "/status", "/offline"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
