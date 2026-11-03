import { NextResponse } from "next/server";

import { integrationStatus } from "@/lib/env";
import { connectDb, dbState } from "@/lib/db/mongoose";
import { getIssueCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * The cheapest place to prove the deployment can actually read its data. A 200
 * with `{count: 0}` is the failure mode a status-code check cannot see, so the
 * counts are always included.
 */
export async function GET() {
  const started = Date.now();
  const integrations = integrationStatus();

  let database: { connected: boolean; error?: string; counts?: Record<string, number> } = {
    connected: false,
  };

  try {
    await connectDb();
    const counts = await getIssueCounts();
    database = { connected: true, counts };
  } catch (error) {
    database = {
      connected: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }

  return NextResponse.json(
    {
      ok: database.connected,
      app: "daet-watch",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      uptimeSeconds: Math.round(process.uptime()),
      latencyMs: Date.now() - started,
      dbState: dbState().readyState,
      database,
      integrations,
    },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
