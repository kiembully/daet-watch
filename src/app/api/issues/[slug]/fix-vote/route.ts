import type { NextRequest } from "next/server";

import { handler, item, requireUser, enforceRateLimit, ApiError } from "@/lib/api";
import { connectDb, oid } from "@/lib/db/mongoose";
import { fixProgress, isOpen } from "@/lib/rules";
import { FixVote, IssueUpdate } from "@/models/engagement";
import { Issue, type IssueDoc } from "@/models/issue";
import { fixVoteSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Any resident can vote "this is fixed". Nothing happens at 1 vote: the status
 * flips only when `fixThreshold` DISTINCT residents agree, which is the whole
 * point of the counter — a single person cannot clear the board.
 */
export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const user = await requireUser();
    const { slug } = await context.params;
    await enforceRateLimit(user.id, "fixvote", LIMITS_PER_DAY);

    const body = fixVoteSchema.parse(await request.json().catch(() => ({})));
    await connectDb();

    const issue = await Issue.findOne({ slug }).lean<IssueDoc>();
    if (!issue) throw new ApiError(404, "not_found", "Issue not found");
    if (issue.status === "hidden") throw new ApiError(404, "not_found", "Issue not found");
    if (!isOpen(issue.status)) throw new ApiError(409, "not_open", "This issue is already fixed");

    const round = issue.reopenCount;

    try {
      await FixVote.create({
        issueId: issue._id,
        userId: oid(user.id),
        round,
        photoUrl: body.photoUrl ?? null,
      });
    } catch (error) {
      const duplicate =
        typeof error === "object" && error !== null && "code" in error && error.code === 11000;
      if (duplicate) {
        return item({
          fixVotes: issue.fixVotes,
          fixThreshold: issue.fixThreshold,
          status: issue.status,
          alreadyVoted: true,
          progress: fixProgress(issue.fixVotes, issue.fixThreshold),
        });
      }
      throw error;
    }

    const votes = await FixVote.countDocuments({ issueId: issue._id, round });
    const progress = fixProgress(votes, issue.fixThreshold);

    if (!progress.reached) {
      const updated = await Issue.findOneAndUpdate(
        { _id: issue._id },
        { $set: { fixVotes: votes } },
        { returnDocument: "after" },
      ).lean<IssueDoc>();
      return item({
        fixVotes: updated?.fixVotes ?? votes,
        fixThreshold: issue.fixThreshold,
        status: updated?.status ?? issue.status,
        alreadyVoted: false,
        progress,
      });
    }

    const fixedAt = new Date();
    const updated = await Issue.findOneAndUpdate(
      { _id: issue._id, status: { $in: ["reported", "confirmed", "unfixed", "reopened"] } },
      { $set: { fixVotes: votes, status: "fixed", fixedAt } },
      { returnDocument: "after" },
    ).lean<IssueDoc>();

    await IssueUpdate.create({
      issueId: issue._id,
      authorId: oid(user.id),
      type: "fixed",
      text: `${progress.target} kapitbahay ang nagkumpirma na ayos na.`,
      photos: body.photoUrl ? [{ url: body.photoUrl, width: 1200, height: 900 }] : [],
    });

    return item({
      fixVotes: updated?.fixVotes ?? votes,
      fixThreshold: issue.fixThreshold,
      status: updated?.status ?? "fixed",
      fixedAt: fixedAt.toISOString(),
      alreadyVoted: false,
      progress,
    });
  },
);

// Fix votes are cheap and the threshold needs several people, so the ceiling is
// generous; the limiter exists to stop a script, not a neighborhood.
const LIMITS_PER_DAY = 50;
