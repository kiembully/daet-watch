import type { NextRequest } from "next/server";

import { handler, list } from "@/lib/api";
import { nearbyQuerySchema } from "@/lib/schemas";
import { getNearbyOpenIssues } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: NextRequest) => {
  const params = nearbyQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const items = await getNearbyOpenIssues(params.lat, params.lng, params.radius, params.category);
  return list(items, items.length);
});
