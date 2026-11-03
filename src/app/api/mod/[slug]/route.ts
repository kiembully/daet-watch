import type { NextRequest } from "next/server";

import { ApiError, handler, item, requireModerator } from "@/lib/api";
import { connectDb, oid } from "@/lib/db/mongoose";
import { mergeReportedAt } from "@/lib/rules";
import { moderationActionSchema } from "@/lib/schemas";
import { Flag, IssueUpdate } from "@/models/engagement";
import { Issue, type IssueDoc } from "@/models/issue";

export const dynamic = "force-dynamic";

/** hide · unhide · merge · recategorise — the four things a volunteer moderator
 *  is trusted with. Deleting is deliberately not one of them. */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const moderator = await requireModerator();
    const { slug } = await context.params;
    const body = moderationActionSchema.parse(await request.json());
    await connectDb();

    const issue = await Issue.findOne({ slug }).lean<IssueDoc>();
    if (!issue) throw new ApiError(404, "not_found", "Issue not found");

    if (body.action === "hide" || body.action === "unhide") {
      const status = body.action === "hide" ? "hidden" : issue.fixedAt ? "fixed" : "confirmed";
      await Issue.updateOne({ _id: issue._id }, { $set: { status } });
      await Flag.updateMany(
        { issueId: issue._id, resolvedAt: null },
        { $set: { resolvedBy: oid(moderator.id), resolvedAt: new Date() } },
      );
      await IssueUpdate.create({
        issueId: issue._id,
        authorId: oid(moderator.id),
        type: "moderation",
        text: body.action === "hide" ? "Hidden by a moderator." : "Restored by a moderator.",
        photos: [],
      });
      return item({ status });
    }

    if (body.action === "recategorise") {
      await Issue.updateOne({ _id: issue._id }, { $set: { category: body.category } });
      return item({ category: body.category });
    }

    // merge: the duplicate points at the survivor, and the survivor keeps the
    // OLDEST reportedAt so merging never resets the days-unfixed counter.
    if (body.targetId === String(issue._id)) {
      throw new ApiError(422, "same_issue", "Pick a different issue to merge into");
    }
    const target = await Issue.findById(body.targetId).lean<IssueDoc>();
    if (!target) throw new ApiError(404, "not_found", "Target issue not found");

    const mergedReportedAt = mergeReportedAt(issue.reportedAt, target.reportedAt);

    await Issue.updateOne(
      { _id: target._id },
      {
        $set: { reportedAt: mergedReportedAt },
        $inc: { confirmations: issue.confirmations },
      },
    );
    await Issue.updateOne(
      { _id: issue._id },
      { $set: { status: "hidden", mergedIntoId: target._id } },
    );

    await IssueUpdate.create({
      issueId: issue._id,
      authorId: oid(moderator.id),
      type: "merged",
      text: `Merged into ${target.slug}. Original report date kept: ${mergedReportedAt.toISOString().slice(0, 10)}.`,
      photos: [],
    });

    return item({
      mergedInto: { id: String(target._id), slug: target.slug },
      reportedAt: mergedReportedAt.toISOString(),
    });
  },
);
