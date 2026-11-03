import "server-only";

import { connectDb } from "@/lib/db/mongoose";
import { MODERATOR_EMAILS } from "@/lib/env";
import { shortId } from "@/lib/slug";
import { User, type UserDoc } from "@/models/user";

export interface UpsertInput {
  email: string | null;
  phone: string | null;
  name: string | null;
  image: string | null;
}

/**
 * One account per person: match on email first, then phone. Nothing here trusts
 * a provider to be consistent about ids, which is why we key on the credential
 * the resident actually owns.
 */
export async function findOrCreateUser(input: UpsertInput): Promise<UserDoc | null> {
  await connectDb();

  const filter = input.email
    ? { email: input.email.toLowerCase() }
    : input.phone
      ? { phone: input.phone }
      : null;
  if (!filter) return null;

  const existing = await User.findOne(filter).lean<UserDoc>();
  if (existing) {
    const patch: Partial<UserDoc> = {};
    if (input.name && input.name !== existing.name) patch.name = input.name;
    if (input.image && input.image !== existing.image) patch.image = input.image;

    // Promotion is by hand (env list or a DB edit), never self-service.
    const shouldBeModerator =
      Boolean(input.email) && MODERATOR_EMAILS.includes(input.email?.toLowerCase() ?? "");
    if (shouldBeModerator && existing.role === "resident") patch.role = "moderator";

    if (Object.keys(patch).length > 0) {
      await User.updateOne({ _id: existing._id }, { $set: patch });
      return { ...existing, ...patch };
    }
    return existing;
  }

  const isModerator =
    Boolean(input.email) && MODERATOR_EMAILS.includes(input.email?.toLowerCase() ?? "");

  const created = await User.create({
    name: input.name,
    email: input.email ? input.email.toLowerCase() : null,
    phone: input.phone,
    image: input.image,
    role: isModerator ? "moderator" : "resident",
    // An empty alias means "use the generated barangay name" at render time.
    displayAlias: `Neighbor ${shortId(3)}`,
    showName: false,
  });

  return created.toObject() as unknown as UserDoc;
}
