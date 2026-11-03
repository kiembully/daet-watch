import type { Metadata } from "next";

import { MapClient } from "@/components/MapClient";
import { MapHeader } from "@/components/headers";
import { getWaterData, listIssues } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Map",
  description: "Every open civic issue in Daet, coloured by how long it has been unfixed.",
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string; slug?: string }>;
}) {
  const params = await searchParams;

  const [page, water] = await Promise.all([
    listIssues({ sort: "longest", status: "all", limit: 24 }).catch(() => ({
      items: [],
      total: 0,
      nextCursor: null,
    })),
    getWaterData().catch(() => ({ sources: [], board: [] })),
  ]);

  const lat = Number(params.lat);
  const lng = Number(params.lng);
  const focus =
    Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0
      ? { lat, lng, slug: params.slug }
      : undefined;

  return (
    <>
      <MapHeader />
      <MapClient issues={page.items} water={water.sources} focus={focus} />
    </>
  );
}
