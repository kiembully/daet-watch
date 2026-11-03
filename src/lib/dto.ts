import type { IssueDoc, IssuePhoto, WaterDetails } from "@/models/issue";
import { daysToFix, daysUnfixed, type Category, type IssueStatus } from "@/lib/rules";

export interface PublicPhoto extends IssuePhoto {
  /** Cloudinary delivery URL at a given width; falls back to the stored url. */
  url: string;
}

export interface PublicReporter {
  displayName: string;
  /** True when the resident chose to show their real name. */
  named: boolean;
}

export interface PublicIssue {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: Category;
  status: IssueStatus;
  barangay: { id: string; name: string } | null;
  location: { lat: number; lng: number };
  addressText: string | null;
  photos: PublicPhoto[];
  reportedAt: string;
  fixedAt: string | null;
  reopenedAt: string | null;
  /** Computed at read time, on the server. Never stored, never sent by a client. */
  days: number;
  daysToFix: number | null;
  confirmations: number;
  fixVotes: number;
  fixThreshold: number;
  reopenCount: number;
  flagCount: number;
  mergedIntoId: string | null;
  reporter: PublicReporter;
  waterDetails: WaterDetails | null;
}

export interface LocalsContext {
  barangayNames: Map<string, string>;
  reporters: Map<string, { name: string | null; displayAlias: string; showName: boolean }>;
  now: Date;
}

/** Reporter identity is private by default; the barangay-shaped name is the fallback. */
export function reporterDisplayName(doc: IssueDoc, ctx: LocalsContext): PublicReporter {
  const reporter = ctx.reporters.get(String(doc.reporterId));
  const barangay = ctx.barangayNames.get(String(doc.barangayId)) ?? "Daet";

  if (reporter?.showName && reporter.name) {
    return { displayName: reporter.name, named: true };
  }
  if (reporter?.displayAlias) {
    return { displayName: reporter.displayAlias, named: false };
  }
  return { displayName: `Neighbor from Brgy. ${barangay}`, named: false };
}

export function toPublicIssue(doc: IssueDoc, ctx: LocalsContext): PublicIssue {
  const [lng, lat] = doc.location.coordinates;
  const days = doc.status === "fixed" && doc.fixedAt
    ? daysUnfixed(doc.reportedAt, doc.fixedAt)
    : daysUnfixed(doc.reportedAt, ctx.now);

  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    status: doc.status,
    barangay: doc.barangayId
      ? {
          id: String(doc.barangayId),
          name: ctx.barangayNames.get(String(doc.barangayId)) ?? "Daet",
        }
      : null,
    location: { lat, lng },
    addressText: doc.addressText,
    photos: doc.photos ?? [],
    reportedAt: new Date(doc.reportedAt).toISOString(),
    fixedAt: doc.fixedAt ? new Date(doc.fixedAt).toISOString() : null,
    reopenedAt: doc.reopenedAt ? new Date(doc.reopenedAt).toISOString() : null,
    days: Math.max(0, days),
    daysToFix: doc.fixedAt ? daysToFix(doc.reportedAt, doc.fixedAt) : null,
    confirmations: doc.confirmations,
    fixVotes: doc.fixVotes,
    fixThreshold: doc.fixThreshold,
    reopenCount: doc.reopenCount,
    flagCount: doc.flagCount,
    mergedIntoId: doc.mergedIntoId ? String(doc.mergedIntoId) : null,
    reporter: reporterDisplayName(doc, ctx),
    waterDetails: doc.waterDetails ?? null,
  };
}
