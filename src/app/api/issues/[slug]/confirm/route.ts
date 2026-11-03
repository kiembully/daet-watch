import type { NextRequest } from "next/server";

import { handler, item, requireUser, enforceRateLimit, ApiError } from "@/lib/api";
import { LIMITS } from "@/lib/env";
import { connectDb, oid } from "@/lib/db/mongoose";
import { isOpen } from "@/lib/rules";
import { Confirmation, IssueUpdate } from "@/models/engagement";
import { Issue, type IssueDoc } from "@/models/issue";

export const dynamic = "force-dynamic";

export const POST = handler(
  async (_request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const user = await requireUser();
    const { slug } = await context.params;
    await enforceRateLimit(user.id, "confirm", LIMITS.confirmsPerDay);
    await connectDb();

    const issue = await Issue.findOne({ slug }).lean<IssueDoc>();
    if (!issue) throw new ApiError(404, "not_found", "Issue not found");
    if (issue.status === "hidden") throw new ApiError(404, "not_found", "Issue not found");
    if (!isOpen(issue.status)) throw new ApiError(409, "not_open", "This issue is already closed");

    // The unique index on (issueId, userId) is the real guard; the duplicate
    // catch below turns it into a legible 409 instead of a 500.
    try {
      await Confirmation.create({ issueId: issue._id, userId: oid(user.id) });
    } catch (error) {
      const duplicate =
        typeof error === "object" && error !== null && "code" in error && error.code === 11000;
      if (duplicate) return item({ confirmations: issue.confirmations, alreadyConfirmed: true });
      throw error;
    }

    const updated = await Issue.findOneAndUpdate(
      { _id: issue._id },
      { $inc: { confirmations: 1 }, ...(issue.status === "reported" ? { $set: { status: "confirmed" } } : {}) },
      { returnDocument: "after" },
    ).lean<IssueDoc>();

    await IssueUpdate.create({
      issueId: issue._id,
      authorId: oid(user.id),
      type: "confirmed",
      text: "Apektado rin ako dito.",
      photos: [],
    });

    return item({
      confirmations: updated?.confirmations ?? issue.confirmations + 1,
      alreadyConfirmed: false,
    });
  },
);
