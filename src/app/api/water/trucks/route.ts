import type { NextRequest } from "next/server";

import { handler, item, list, requireUser, screenText } from "@/lib/api";
import { connectDb, oid } from "@/lib/db/mongoose";
import { getBarangayNames, getBarangays } from "@/lib/queries";
import { truckReportSchema } from "@/lib/schemas";
import { WaterTruckReport, type WaterTruckReportDoc } from "@/models/water";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await connectDb();
  const rows = await WaterTruckReport.find()
    .sort({ spottedAt: -1 })
    .limit(20)
    .lean<WaterTruckReportDoc[]>();
  const names = await getBarangayNames();

  return list(
    rows.map((row) => ({
      id: String(row._id),
      barangay: names.get(String(row.barangayId)) ?? "Daet",
      spottedAt: new Date(row.spottedAt).toISOString(),
      note: row.note,
      location: row.location
        ? { lat: row.location.coordinates[1], lng: row.location.coordinates[0] }
        : null,
    })),
    rows.length,
  );
});

export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser();
  const body = truckReportSchema.parse(await request.json());
  await connectDb();

  const barangays = await getBarangays();
  if (!barangays.some((b) => String(b._id) === body.barangayId)) {
    return item({ ok: false }, 422);
  }

  const created = await WaterTruckReport.create({
    barangayId: oid(body.barangayId),
    location: body.location
      ? { type: "Point", coordinates: [body.location.lng, body.location.lat] }
      : null,
    spottedAt: body.spottedAt ?? new Date(),
    reportedBy: oid(user.id),
    note: body.note ? screenText(body.note) : null,
  });

  return item({ id: String(created._id) }, 201);
});
