import type { Metadata } from "next";

import { WaterClient } from "@/components/WaterClient";
import { WaterHeader } from "@/components/headers";
import { auth } from "@/auth";
import { getWaterData, getBarangays } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Water",
  description: "Water sources and trucks in Daet, confirmed by neighbors.",
};

export default async function WaterPage() {
  const [data, barangays, session] = await Promise.all([
    getWaterData().catch(() => ({ sources: [], board: [] })),
    getBarangays().catch(() => []),
    auth().catch(() => null),
  ]);

  return (
    <>
      <WaterHeader />
      <WaterClient
        sources={data.sources}
        board={data.board}
        barangays={barangays.map((b) => ({ id: String(b._id), name: b.name }))}
        signedIn={Boolean(session?.user?.id)}
      />
    </>
  );
}
