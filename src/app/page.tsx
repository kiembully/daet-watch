import { FeedClient } from "@/components/FeedClient";
import { HomeHeader } from "@/components/headers";
import { getBarangays, listIssues } from "@/lib/queries";
import type { PublicIssue } from "@/lib/dto";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let initial: PublicIssue[] = [];
  let cursor: string | null = null;
  let barangays: { id: string; name: string }[] = [];
  let dbDown = false;

  try {
    const [page, rows] = await Promise.all([
      listIssues({ sort: "longest", status: "open", limit: 10 }),
      getBarangays(),
    ]);
    initial = page.items;
    cursor = page.nextCursor;
    barangays = rows.map((b) => ({ id: String(b._id), name: b.name }));
  } catch {
    // A database that is not configured or unreachable must render the shell,
    // not a 500 — the seeded/empty state is still a usable page.
    dbDown = true;
  }

  return (
    <>
      <HomeHeader />
      {dbDown ? (
        <div className="mx-3 mt-3 rounded-xl border border-line bg-surface p-3 text-sm text-muted">
          The database is not reachable yet. Run <code className="font-mono">npm run seed</code> and reload.
        </div>
      ) : null}
      <FeedClient initial={initial} initialCursor={cursor} barangays={barangays} />
    </>
  );
}
