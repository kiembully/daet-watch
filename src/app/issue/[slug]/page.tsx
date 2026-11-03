import type { Metadata } from "next";
import Link from "next/link";

import { IssueDetail } from "@/components/IssueDetail";
import { AppBar } from "@/components/Shell";
import { auth } from "@/auth";
import { connectDb, oid } from "@/lib/db/mongoose";
import { getIssueBySlug, getTimeline } from "@/lib/queries";
import { Confirmation, FixVote, Flag, ReopenVote } from "@/models/engagement";

export const dynamic = "force-dynamic";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const issue = await getIssueBySlug(slug).catch(() => null);
  if (!issue) return { title: "Issue not found" };

  const counter =
    issue.status === "fixed"
      ? `FIXED after ${issue.daysToFix ?? issue.days} days`
      : `DAY ${issue.days} UNFIXED`;
  const title = `${counter} — ${issue.title}`;
  const description = `${issue.barangay?.name ?? "Daet"} · ${issue.confirmations} neighbors affected. Community-reported. Not verified by the LGU.`;

  const images = [{ url: `${SITE}/api/og/${issue.slug}`, width: 1200, height: 630 }];

  return {
    title,
    description,
    alternates: { canonical: `${SITE}/issue/${issue.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `${SITE}/issue/${issue.slug}`,
      siteName: "Daet Watch",
      images,
      publishedTime: issue.reportedAt,
    },
    twitter: { card: "summary_large_image", title, description, images: images.map((i) => i.url) },
  };
}

export default async function IssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const issue = await getIssueBySlug(slug).catch(() => null);

  if (!issue || issue.status === "hidden") {
    return (
      <>
        <AppBar title="Issue not found" back="/" />
        <div className="p-6 text-center">
          <p className="text-sm text-muted">This issue doesn&apos;t exist or was removed.</p>
          <Link
            href="/"
            className="press mt-4 inline-block rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper"
          >
            Back to the feed
          </Link>
        </div>
      </>
    );
  }

  const [timeline, session] = await Promise.all([getTimeline(issue.id), auth().catch(() => null)]);
  const userId = session?.user?.id;

  let viewer = { confirmed: false, fixVoted: false, reopenVoted: false, flagged: false };
  if (userId) {
    await connectDb();
    const round = issue.reopenCount;
    const [confirmed, fixVoted, reopenVoted, flagged] = await Promise.all([
      Confirmation.exists({ issueId: oid(issue.id), userId: oid(userId) }),
      FixVote.exists({ issueId: oid(issue.id), userId: oid(userId), round }),
      ReopenVote.exists({ issueId: oid(issue.id), userId: oid(userId), round: round + 1 }),
      Flag.exists({ issueId: oid(issue.id), userId: oid(userId) }),
    ]);
    viewer = {
      confirmed: Boolean(confirmed),
      fixVoted: Boolean(fixVoted),
      reopenVoted: Boolean(reopenVoted),
      flagged: Boolean(flagged),
    };
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: issue.title,
    datePublished: issue.reportedAt,
    image: issue.photos.map((p) => p.url),
    articleBody: issue.description,
    author: { "@type": "Person", name: issue.reporter.displayName },
    locationCreated: {
      "@type": "Place",
      name: issue.barangay?.name ?? "Daet",
      address: { "@type": "PostalAddress", addressLocality: "Daet", addressRegion: "Camarines Norte", addressCountry: "PH" },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <IssueDetail issue={issue} timeline={timeline} viewer={viewer} signedIn={Boolean(userId)} />
    </>
  );
}
