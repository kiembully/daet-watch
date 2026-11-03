import { handler, list, requireModerator } from "@/lib/api";
import { connectDb } from "@/lib/db/mongoose";
import { getBarangayNames } from "@/lib/queries";
import { toPublicIssue } from "@/lib/dto";
import { Flag } from "@/models/engagement";
import { Issue, type IssueDoc } from "@/models/issue";

export const dynamic = "force-dynamic";

/** The queue a moderator works from: any issue with at least one unresolved
 *  flag, newest first, plus the reasons people gave. */
export const GET = handler(async () => {
  await requireModerator();
  await connectDb();

  const flags = await Flag.find({ resolvedAt: null })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean<{ _id: unknown; issueId: unknown; reason: string; note: string | null; createdAt: Date }[]>();

  const issueIds = [...new Set(flags.map((f) => String(f.issueId)))];
  const issues = await Issue.find({ _id: { $in: issueIds } }).lean<IssueDoc[]>();
  const names = await getBarangayNames();

  const ctx = {
    barangayNames: names,
    reporters: new Map<string, { name: string | null; displayAlias: string; showName: boolean }>(),
    now: new Date(),
  };

  const items = issues.map((issue) => ({
    issue: toPublicIssue(issue, ctx),
    flags: flags
      .filter((f) => String(f.issueId) === String(issue._id))
      .map((f) => ({
        id: String(f._id),
        reason: f.reason,
        note: f.note,
        createdAt: new Date(f.createdAt).toISOString(),
      })),
  }));

  return list(items, items.length);
});
