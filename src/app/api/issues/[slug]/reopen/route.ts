import type { NextRequest } from "next/server";

import { handler, item, requireUser, ApiError } from "@/lib/api";
import { connectDb, oid } from "@/lib/db/mongoose";
import { canReopen, fixProgress, FIX_THRESHOLD, REOPEN_WINDOW_DAYS } from "@/lib/rules";
import { IssueUpdate, ReopenVote } from "@/models/engagement";
import { Issue, type IssueDoc } from "@/models/issue";
import { reopenSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Reopening needs the same threshold in reverse — three residents saying it is
 * broken again — inside a 60-day window from the fix. A moderator can reopen
 * alone, because that is the escape hatch when a fix report was wrong.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const user = await requireUser();
    const { slug } = await context.params;
    const body = reopenSchema.parse(await request.json());
    await connectDb();

    const issue = await Issue.findOne({ slug }).lean<IssueDoc>();
    if (!issue) throw new ApiError(404, "not_found", "Issue not found");
    if (issue.status !== "fixed") throw new ApiError(409, "not_fixed", "This issue is not fixed");

    const now = new Date();
    if (!canReopen(issue.fixedAt, issue.status, now)) {
      throw new ApiError(
        409,
        "window_closed",
        `Reopening closes ${REOPEN_WINDOW_DAYS} days after the fix`,
      );
    }

    if (user.role === "moderator" || user.role === "official") {
      const updated = await Issue.findOneAndUpdate(
        { _id: issue._id },
        {
          $set: { status: "reopened", reopenedAt: now, fixVotes: 0 },
          $inc: { reopenCount: 1 },
        },
        { returnDocument: "after" },
      ).lean<IssueDoc>();

      await IssueUpdate.create({
        issueId: issue._id,
        authorId: oid(user.id),
        type: "reopened",
        text: body.reason,
        photos: body.photoUrl ? [{ url: body.photoUrl, width: 1200, height: 900 }] : [],
      });

      return item({
        status: updated?.status ?? "reopened",
        reopenCount: updated?.reopenCount ?? issue.reopenCount + 1,
        votes: FIX_THRESHOLD,
        threshold: FIX_THRESHOLD,
        reopenedByModerator: true,
      });
    }

    const round = issue.reopenCount + 1;

    try {
      await ReopenVote.create({
        issueId: issue._id,
        userId: oid(user.id),
        round,
        reason: body.reason,
        photoUrl: body.photoUrl ?? null,
      });
    } catch (error) {
      const duplicate =
        typeof error === "object" && error !== null && "code" in error && error.code === 11000;
      if (duplicate) {
        return item({ status: issue.status, alreadyVoted: true, votes: 0, threshold: FIX_THRESHOLD });
      }
      throw error;
    }

    const votes = await ReopenVote.countDocuments({ issueId: issue._id, round });
    const progress = fixProgress(votes, FIX_THRESHOLD);

    if (!progress.reached) {
      return item({
        status: issue.status,
        alreadyVoted: false,
        votes,
        threshold: FIX_THRESHOLD,
        progress,
      });
    }

    const updated = await Issue.findOneAndUpdate(
      { _id: issue._id, status: "fixed" },
      { $set: { status: "reopened", reopenedAt: now, fixVotes: 0 }, $inc: { reopenCount: 1 } },
      { returnDocument: "after" },
    ).lean<IssueDoc>();

    await IssueUpdate.create({
      issueId: issue._id,
      authorId: oid(user.id),
      type: "reopened",
      text: body.reason,
      photos: body.photoUrl ? [{ url: body.photoUrl, width: 1200, height: 900 }] : [],
    });

    return item({
      status: updated?.status ?? "reopened",
      alreadyVoted: false,
      votes,
      threshold: FIX_THRESHOLD,
      reopenCount: updated?.reopenCount ?? round,
      progress,
    });
  },
);
