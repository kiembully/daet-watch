import type { NextRequest } from "next/server";

import { handler, item, requireUser, screenText, ApiError } from "@/lib/api";
import { connectDb, oid } from "@/lib/db/mongoose";
import { addUpdateSchema } from "@/lib/schemas";
import { IssueUpdate, type IssueUpdateDoc } from "@/models/engagement";
import { Issue, type IssueDoc } from "@/models/issue";

export const dynamic = "force-dynamic";

export const POST = handler(
  async (request: NextRequest, context: { params: Promise<{ slug: string }> }) => {
    const user = await requireUser();
    const { slug } = await context.params;
    const body = addUpdateSchema.parse(await request.json());
    await connectDb();

    const issue = await Issue.findOne({ slug }).lean<IssueDoc>();
    if (!issue) throw new ApiError(404, "not_found", "Issue not found");
    if (issue.status === "hidden") throw new ApiError(404, "not_found", "Issue not found");

    const created = await IssueUpdate.create({
      issueId: issue._id,
      authorId: oid(user.id),
      type: body.type,
      text: body.text ? screenText(body.text) : "",
      photos: body.photos ?? [],
    });

    const doc = created.toObject() as unknown as IssueUpdateDoc;

    return item(
      {
        id: String(doc._id),
        type: doc.type,
        text: doc.text,
        photos: doc.photos,
        createdAt: new Date(doc.createdAt).toISOString(),
      },
      201,
    );
  },
);
