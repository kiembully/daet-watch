import type { Metadata } from "next";

import { StatusHeader } from "@/components/headers";
import { integrationStatus } from "@/lib/env";
import { dbState } from "@/lib/db/mongoose";
import { getIssueCounts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Status", robots: { index: false } };

export default async function StatusPage() {
  const integrations = integrationStatus();
  let counts: Record<string, number> | null = null;
  let error: string | null = null;

  try {
    counts = await getIssueCounts();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "unknown error";
  }

  const connection = dbState();

  return (
    <>
      <StatusHeader />
      <div className="space-y-3 p-3">
        <section className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Database</h2>
          <p className="mt-1 text-sm text-body">
            readyState <span className="font-mono">{connection.readyState}</span> ·{" "}
            {connection.dbName ?? "no database"}
          </p>
          {error ? <p className="mt-1 text-sm text-day-red">error: {error}</p> : null}
        </section>

        {counts ? (
          <section className="grid grid-cols-2 gap-2">
            {(
              [
                ["barangays", counts.barangays],
                ["users", counts.users],
                ["issues", counts.issues],
                ["open", counts.open],
                ["fixed", counts.fixed],
                ["water sources", counts.water],
                ["timeline events", counts.updates],
                ["hidden", counts.hidden],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="card p-3">
                <p className="daynum text-3xl font-black text-ink">{value}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Integrations</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(integrations).map(([key, value]) => (
              <li key={key} className="flex items-center justify-between border-b border-line/60 pb-1">
                <span className="text-body">{key}</span>
                <span className={value ? "font-bold text-fixed" : "font-bold text-muted"}>
                  {value ? "configured" : "not set"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Seed content</h2>
          <p className="mt-1 text-sm text-body">
            The 25 barangays are real (PSA PSGC 2023). Every issue, comment and water source is
            demo data — marked as such in its own description.
          </p>
        </section>
      </div>
    </>
  );
}
