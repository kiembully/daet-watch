import type { NextRequest } from "next/server";

import { handler, item, list, ApiError, requireUser, enforceRateLimit, screenText } from "@/lib/api";
import { LIMITS } from "@/lib/env";
import { listIssues } from "@/lib/queries";
import { createIssueSchema, listIssuesQuerySchema } from "@/lib/schemas";
import { makeSlug } from "@/lib/slug";
import { FIX_THRESHOLD } from "@/lib/rules";
import { Barangay } from "@/models/barangay";
import { IssueUpdate } from "@/models/engagement";
import { Issue } from "@/models/issue";
import { connectDb, isValidObjectId, oid } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: NextRequest) => {
  const url = new URL(request.url);
  const params = listIssuesQuerySchema.parse(Object.fromEntries(url.searchParams));

  let barangayId = params.barangay;
  if (barangayId && !isValidObjectId(barangayId)) {
    await connectDb();
    const match = await Barangay.findOne({ name: params.barangay }).select("_id").lean<{ _id: MT.ObjectId }>();
    barangayId = match ? String(match._id) : "000000000000000000000000";
  }

  const page = await listIssues({
    sort: params.sort,
    category: params.category,
    barangay: barangayId,
    status: params.status,
    cursor: params.cursor ?? null,
    limit: params.limit,
    q: params.q,
  });

  return list(page.items, page.total, page.nextCursor);
});

export const POST = handler(async (request: NextRequest) => {
  const user = await requireUser();
  await enforceRateLimit(user.id, "report", LIMITS.reportsPerDay);

  const body = createIssueSchema.parse(await request.json());
  await connectDb();

  const barangay = await Barangay.findById(body.barangayId).lean<{ _id: MT.ObjectId; name: string }>();
  if (!barangay) throw new ApiError(422, "unknown_barangay", "Pick a barangay in Daet");

  const photos = body.photos.map((photo: { url: string; width: number; height: number }) => ({
    url: photo.url,
    width: photo.width,
    height: photo.height,
  }));

  let created = null;
  for (let attempt = 0; attempt < 4 && !created; attempt += 1) {
    try {
      created = await Issue.create({
        slug: makeSlug(body.category, 6 + attempt),
        title: screenText(body.title),
        description: screenText(body.description),
        category: body.category,
        barangayId: oid(body.barangayId),
        location: { type: "Point", coordinates: [body.location.lng, body.location.lat] },
        addressText: body.addressText ? screenText(body.addressText) : null,
        photos,
        reporterId: oid(user.id),
        // Server-set. A client-supplied reportedAt is never read.
        reportedAt: new Date(),
        status: "reported",
        fixThreshold: FIX_THRESHOLD,
        waterDetails:
          body.category === "water" && body.waterDetails
            ? {
                outageStartedAt: body.waterDetails.outageStartedAt ?? null,
                householdsAffectedEstimate: body.waterDetails.householdsAffectedEstimate ?? null,
              }
            : null,
      });
    } catch (error) {
      const duplicate =
        typeof error === "object" && error !== null && "code" in error && error.code === 11000;
      if (!duplicate) throw error;
    }
  }

  if (!created) throw new ApiError(500, "slug_collision", "Could not allocate a link, try again");

  await IssueUpdate.create({
    issueId: created._id,
    authorId: oid(user.id),
    type: "reported",
    text: created.description,
    photos,
  });

  return item(
    {
      id: String(created._id),
      slug: created.slug,
      url: `/issue/${created.slug}`,
    },
    201,
  );
});
