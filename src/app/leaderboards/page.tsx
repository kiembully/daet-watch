import type { Metadata } from "next";
import Link from "next/link";

import { LeaderboardHeader } from "@/components/headers";
import { DaysBadge } from "@/components/issue";
import { getLeaderboards } from "@/lib/queries";
import type { PublicIssue } from "@/lib/dto";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboards",
  description: "Longest unfixed, most affected, and recently fixed issues in Daet.",
};

function Row({ issue, value }: { issue: PublicIssue; value: string }) {
  return (
    <li>
      <Link
        href={`/issue/${issue.slug}`}
        className="press flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5"
      >
        {issue.photos[0] ? (
          <img
            src={issue.photos[0].url}
            alt=""
            width={issue.photos[0].width}
            height={issue.photos[0].height}
            loading="lazy"
            className="size-14 shrink-0 rounded-lg object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-ink">{issue.title}</p>
          <p className="text-[11px] text-muted">
            {issue.barangay?.name} · {value}
          </p>
        </div>
        <DaysBadge
          days={issue.days}
          fixed={issue.status === "fixed"}
          daysToFix={issue.daysToFix}
        />
      </Link>
    </li>
  );
}

export default async function LeaderboardsPage() {
  const data = await getLeaderboards().catch(() => ({
    longest: [],
    mostAffected: [],
    recentlyFixed: [],
  }));

  return (
    <>
      <LeaderboardHeader />
      <div className="space-y-5 p-3">
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">
            Longest unfixed in Daet
          </h2>
          <ol className="mt-2 space-y-2">
            {data.longest.map((issue) => (
              <Row key={issue.id} issue={issue} value={`${issue.days} days`} />
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Most affected</h2>
          <ol className="mt-2 space-y-2">
            {data.mostAffected.map((issue) => (
              <Row key={issue.id} issue={issue} value={`+${issue.confirmations} neighbors`} />
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Recently fixed</h2>
          <ol className="mt-2 space-y-2">
            {data.recentlyFixed.map((issue) => (
              <Row key={issue.id} issue={issue} value={`took ${issue.daysToFix ?? issue.days} days`} />
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
