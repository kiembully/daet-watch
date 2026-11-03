import type { MetadataRoute } from "next";

import { connectDb } from "@/lib/db/mongoose";
import { Issue } from "@/models/issue";

export const revalidate = 3600;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Static pages plus every public issue — a shareable link should also be a
 *  crawlable one, otherwise the only way an issue is ever found is a repost. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE}/map`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE}/water`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${SITE}/leaderboards`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    await connectDb();
    const issues = await Issue.find({ status: { $ne: "hidden" }, mergedIntoId: null })
      .select("slug updatedAt")
      .sort({ updatedAt: -1 })
      .limit(5000)
      .lean<{ slug: string; updatedAt: Date }[]>();

    return [
      ...staticRoutes,
      ...issues.map((issue) => ({
        url: `${SITE}/issue/${issue.slug}`,
        lastModified: new Date(issue.updatedAt),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
