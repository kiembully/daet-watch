import type { NextRequest } from "next/server";

import { handler, item, requireUser, ApiError } from "@/lib/api";
import { connectDb, isValidObjectId, oid } from "@/lib/db/mongoose";
import { waterStatusSchema } from "@/lib/schemas";
import { WaterSource, type WaterSourceDoc } from "@/models/water";

export const dynamic = "force-dynamic";

/** Anyone can say a source is empty or running — that is the whole feature.
 *  Each confirmation is appended with its author so a stale source can be
 *  trusted less than a freshly confirmed one. */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await context.params;
    if (!isValidObjectId(id)) throw new ApiError(404, "not_found", "Unknown water source");

    const body = waterStatusSchema.parse(await request.json());
    await connectDb();

    const now = new Date();
    const updated = await WaterSource.findOneAndUpdate(
      { _id: oid(id) },
      {
        $set: { status: body.status, lastConfirmedAt: now },
        $push: {
          confirmations: {
            $each: [{ userId: oid(user.id), status: body.status, at: now }],
            // Keep the embedded history bounded; the document is not a ledger.
            $slice: -20,
          },
        },
      },
      { returnDocument: "after" },
    ).lean<WaterSourceDoc>();

    if (!updated) throw new ApiError(404, "not_found", "Unknown water source");

    return item({
      id,
      status: updated.status,
      lastConfirmedAt: now.toISOString(),
    });
  },
);
