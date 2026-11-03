import type { NextRequest } from "next/server";

import { handler, item, requireUser, enforceRateLimit, ApiError, screenText } from "@/lib/api";
import { LIMITS } from "@/lib/env";
import { connectDb, oid } from "@/lib/db/mongoose";
import { shouldAutoHide } from "@/lib/rules";
import { Flag, IssueUpdate } from "@/models/engagement";
import { Issue, type IssueDoc } from "@/models/issue";
import { flagSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const user = await requireUser();
    const { slug } = await context.params;
    await enforceRateLimit(user.id, "flag", LIMITS.flagsPerDay);

    const body = flagSchema.parse(await request.json());
    await connectDb();

    const issue = await Issue.findOne({ slug }).lean<IssueDoc>();
    if (!issue) throw new ApiError(404, "not_found", "Issue not found");

    try {
      await Flag.create({
        issueId: issue._id,
        updateId: body.updateId ? oid(body.updateId) : null,
        userId: oid(user.id),
        reason: body.reason,
        note: body.note ? screenText(body.note) : null,
      });
    } catch (error) {
      const duplicate =
        typeof error === "object" && error !== null && "code" in error && error.code === 11000;
      if (duplicate) return item({ flagCount: issue.flagCount, alreadyFlagged: true });
      throw error;
    }

    const updated = await Issue.findOneAndUpdate(
      { _id: issue._id },
      { $inc: { flagCount: 1 } },
      { returnDocument: "after" },
    ).lean<IssueDoc>();

    const flagCount = updated?.flagCount ?? issue.flagCount + 1;

    // Three independent flags take an issue off the feed until a moderator looks.
    if (shouldAutoHide(flagCount) && issue.status !== "hidden") {
      await Issue.updateOne({ _id: issue._id }, { $set: { status: "hidden" } });
      await IssueUpdate.create({
        issueId: issue._id,
        authorId: null,
        type: "moderation",
        text: "Auto-hidden after 3 community flags. Waiting for moderator review.",
        photos: [],
      });
    }

    return item({ flagCount, alreadyFlagged: false, hidden: shouldAutoHide(flagCount) });
  },
);
