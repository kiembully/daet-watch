import type { Metadata } from "next";

import { ModClient } from "@/components/ModClient";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Moderation", robots: { index: false } };

export default async function ModPage() {
  const session = await auth().catch(() => null);
  const role = session?.user?.role;
  const allowed = role === "moderator" || role === "official";

  return <ModClient signedIn={Boolean(session?.user?.id) && allowed} />;
}
