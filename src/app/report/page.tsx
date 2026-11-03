import type { Metadata } from "next";

import { ReportStepper } from "@/components/ReportStepper";
import { auth } from "@/auth";
import { getBarangays } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report an issue",
  description: "Report a civic problem in Daet in six steps. Works offline.",
};

export default async function ReportPage() {
  const [barangays, session] = await Promise.all([
    getBarangays().catch(() => []),
    auth().catch(() => null),
  ]);

  return (
    <ReportStepper
      signedIn={Boolean(session?.user?.id)}
      barangays={barangays.map((b) => ({
        id: String(b._id),
        name: b.name,
        lat: b.centroid.coordinates[1],
        lng: b.centroid.coordinates[0],
      }))}
    />
  );
}
