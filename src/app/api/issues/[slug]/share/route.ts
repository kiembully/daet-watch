import type { NextRequest } from "next/server";

import { ApiError, handler, item } from "@/lib/api";
import { connectDb } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";
import { shareEventSchema } from "@/lib/schemas";
import { ShareEvent } from "@/models/engagement";
import { Issue } from "@/models/issue";

export const dynamic = "force-dynamic";

/** Analytics only — a share must never fail because logging failed. */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const body = shareEventSchema.parse(await request.json().catch(() => ({ channel: "other" })));

    try {
      await connectDb();
      const issue = await Issue.findOne({ slug }).select("_id").lean<{ _id: MT.ObjectId }>();
      if (!issue) throw new ApiError(404, "not_found", "Issue not found");
      await ShareEvent.create({ issueId: issue._id, channel: body.channel });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      // Swallow: analytics is never worth a broken share sheet.
    }

    return item({ logged: true });
  },
);
