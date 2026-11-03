import type { Metadata } from "next";

import { ProfileClient } from "@/components/ProfileClient";
import { auth } from "@/auth";
import { connectDb, oid } from "@/lib/db/mongoose";
import { getMyIssues, countMyConfirmations } from "@/lib/queries";
import { User, type UserDoc } from "@/models/user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Profile", robots: { index: false } };

export default async function ProfilePage() {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;

  let user: UserDoc | null = null;
  let myIssues: Awaited<ReturnType<typeof getMyIssues>> = [];
  let confirmations = 0;

  if (userId) {
    try {
      await connectDb();
      const [doc, issues, count] = await Promise.all([
        User.findById(oid(userId)).lean<UserDoc>(),
        getMyIssues(userId),
        countMyConfirmations(userId),
      ]);
      user = doc;
      myIssues = issues;
      confirmations = count;
    } catch {
      /* a database that is down should still render the settings shell */
    }
  }

  return (
    <ProfileClient
      signedIn={Boolean(userId)}
      name={user?.name ?? session?.user?.name ?? null}
      email={user?.email ?? session?.user?.email ?? null}
      role={user?.role ?? "resident"}
      alias={user?.displayAlias ?? ""}
      showName={user?.showName ?? false}
      myIssues={myIssues}
      confirmations={confirmations}
    />
  );
}
