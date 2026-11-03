import type { NextRequest } from "next/server";

import { handler, item, requireUser, ApiError } from "@/lib/api";
import { connectDb, oid } from "@/lib/db/mongoose";
import { screenText } from "@/lib/api";
import { profileUpdateSchema } from "@/lib/schemas";
import { User, type UserDoc } from "@/models/user";

export const dynamic = "force-dynamic";

export const PATCH = handler(async (request: NextRequest) => {
  const user = await requireUser();
  const body = profileUpdateSchema.parse(await request.json());
  await connectDb();

  const patch: Partial<UserDoc> = {};
  if (body.displayAlias !== undefined) patch.displayAlias = screenText(body.displayAlias);
  if (body.showName !== undefined) patch.showName = body.showName;
  if (body.barangayId !== undefined) {
    patch.barangayId = body.barangayId ? oid(body.barangayId) : null;
  }

  const updated = await User.findByIdAndUpdate(
    user.id,
    { $set: patch },
    { returnDocument: "after" },
  ).lean<UserDoc>();

  if (!updated) throw new ApiError(404, "not_found", "Account not found");

  return item({
    displayAlias: updated.displayAlias,
    showName: updated.showName,
    barangayId: updated.barangayId ? String(updated.barangayId) : null,
  });
});
