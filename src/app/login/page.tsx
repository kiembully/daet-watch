import type { Metadata } from "next";

import { LoginClient } from "@/components/LoginClient";
import { auth } from "@/auth";
import { DEMO_LOGIN_ENABLED } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [params, session] = await Promise.all([searchParams, auth().catch(() => null)]);

  return (
    <LoginClient
      providers={{
        google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
        facebook: Boolean(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET),
      }}
      demoEnabled={DEMO_LOGIN_ENABLED}
      next={params.next && params.next.startsWith("/") ? params.next : "/"}
      signedIn={Boolean(session?.user?.id)}
    />
  );
}
