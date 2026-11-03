import type { NextRequest } from "next/server";
import { z } from "zod";

import { handler, item, list, requireUser, ApiError, screenText } from "@/lib/api";
import { connectDb, oid } from "@/lib/db/mongoose";
import { getBarangayNames, getWaterData } from "@/lib/queries";
import { createWaterSourceSchema } from "@/lib/schemas";
import { WATER_SOURCE_TYPES } from "@/models/water";
import { WaterSource, type WaterSourceDoc } from "@/models/water";
import { Barangay } from "@/models/barangay";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().int().min(10).max(20_000).default(3000),
  type: z.enum(WATER_SOURCE_TYPES).optional(),
});

export const GET = handler(async (request: NextRequest) => {
  const params = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

  if (params.lat === undefined || params.lng === undefined) {
    const data = await getWaterData();
    return list(data.sources, data.sources.length);
  }

  await connectDb();
  const filter: Record<string, unknown> = {
    location: {
      $nearSphere: {
        $geometry: { type: "Point", coordinates: [params.lng, params.lat] },
        $maxDistance: params.radius,
      },
    },
  };
  if (params.type) filter.type = params.type;

  const rows = await WaterSource.find(filter).limit(50).lean<WaterSourceDoc[]>();
  const names = await getBarangayNames();

  return list(
    rows.map((row) => ({
      id: String(row._id),
      name: row.name,
      type: row.type,
      barangay: names.get(String(row.barangayId)) ?? "Daet",
      status: row.status,
      lastConfirmedAt: row.lastConfirmedAt ? new Date(row.lastConfirmedAt).toISOString() : null,
      location: { lat: row.location.coordinates[1], lng: row.location.coordinates[0] },
    })),
    rows.length,
  );
});

export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser();
  const body = createWaterSourceSchema.parse(await request.json());
  await connectDb();

  const barangay = await Barangay.findById(body.barangayId).lean<{ _id: unknown; centroid: { coordinates: [number, number] } }>();
  if (!barangay) throw new ApiError(422, "unknown_barangay", "Pick a barangay in Daet");

  const coordinates: [number, number] = body.location
    ? [body.location.lng, body.location.lat]
    : barangay.centroid.coordinates;

  const created = await WaterSource.create({
    name: screenText(body.name),
    type: body.type,
    barangayId: oid(body.barangayId),
    location: { type: "Point", coordinates },
    status: body.status,
    lastConfirmedAt: body.status === "unknown" ? null : new Date(),
    confirmations: [],
    createdBy: oid(user.id),
  });

  return item({ id: String(created._id), slug: String(created._id) }, 201);
});
