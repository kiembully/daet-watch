import type { NextRequest } from "next/server";

import { currentUser, handler, item, ApiError } from "@/lib/api";
import { getIssueBySlug, getIssueRaw, getTimeline } from "@/lib/queries";
import { connectDb, oid } from "@/lib/db/mongoose";
import { Confirmation, FixVote, Flag, ReopenVote } from "@/models/engagement";

export const dynamic = "force-dynamic";

export const GET = handler(
  async (_request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;
    const issue = await getIssueBySlug(slug);
    if (!issue || issue.status === "hidden") {
      throw new ApiError(404, "not_found", "This issue does not exist or was removed");
    }

    const timeline = await getTimeline(issue.id);

    // Viewer state is what makes the buttons honest: "Me too" already pressed,
    // a fix vote already cast, a flag already filed.
    const user = await currentUser();
    let viewer = { confirmed: false, fixVoted: false, reopenVoted: false, flagged: false };
    if (user) {
      await connectDb();
      const round = issue.reopenCount;
      const [confirmed, fixVoted, reopenVoted, flagged] = await Promise.all([
        Confirmation.exists({ issueId: oid(issue.id), userId: oid(user.id) }),
        FixVote.exists({ issueId: oid(issue.id), userId: oid(user.id), round }),
        ReopenVote.exists({ issueId: oid(issue.id), userId: oid(user.id), round: round + 1 }),
        Flag.exists({ issueId: oid(issue.id), userId: oid(user.id) }),
      ]);
      viewer = {
        confirmed: Boolean(confirmed),
        fixVoted: Boolean(fixVoted),
        reopenVoted: Boolean(reopenVoted),
        flagged: Boolean(flagged),
      };
    }

    return item({ issue, timeline, viewer, signedIn: Boolean(user) });
  },
);

/** Kept for the moderator merge flow, which needs the raw document. */
export async function loadRawIssue(slug: string) {
  const doc = await getIssueRaw(slug);
  if (!doc) throw new ApiError(404, "not_found", "Issue not found");
  return doc;
}
