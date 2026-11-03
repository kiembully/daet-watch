import "server-only";

import { cache } from "react";

import { connectDb, oid, Types } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";
import { toPublicIssue, type LocalsContext, type PublicIssue } from "@/lib/dto";
import { daysUnfixed, OPEN_STATUSES, type Category } from "@/lib/rules";
import { Barangay, type BarangayDoc } from "@/models/barangay";
import { Confirmation, IssueUpdate, type IssueUpdateDoc } from "@/models/engagement";
import { Issue, type IssueDoc } from "@/models/issue";
import { User } from "@/models/user";
import { WaterSource, type WaterSourceDoc } from "@/models/water";

export interface IssueQuery {
  sort: "longest" | "newest" | "fixed" | "affected";
  category?: Category;
  barangay?: string;
  status?: "open" | "fixed" | "all";
  cursor?: string | null;
  limit: number;
  q?: string;
}

/** 25 documents — read per request, shared by every join in that request. */
export const getBarangays = cache(async (): Promise<BarangayDoc[]> => {
  await connectDb();
  return Barangay.find().sort({ name: 1 }).lean<BarangayDoc[]>();
});

export async function getBarangayNames(): Promise<Map<string, string>> {
  const rows = await getBarangays();
  return new Map(rows.map((b) => [String(b._id), b.name]));
}

export async function getReporters(ids: string[]) {
  if (ids.length === 0) return new Map();
  await connectDb();
  const unique = [...new Set(ids)];
  type ReporterRow = {
    _id: MT.ObjectId;
    name: string | null;
    displayAlias: string;
    showName: boolean;
  };
  const users = await User.find({ _id: { $in: unique.map(oid) } })
    .select("name displayAlias showName")
    .lean<ReporterRow[]>();
  return new Map(
    users.map((u) => [
      String(u._id),
      { name: u.name, displayAlias: u.displayAlias, showName: u.showName },
    ]),
  );
}

function parseCursorValue(cursor?: string | null): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [at, id] = cursor.split("|");
  if (!at || !id) return null;
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? null : { at: date, id };
}

export async function listIssues(query: IssueQuery): Promise<{
  items: PublicIssue[];
  nextCursor: string | null;
  total: number;
}> {
  await connectDb();

  const filter: Record<string, unknown> = { mergedIntoId: null };
  if (query.status === "fixed") filter.status = "fixed";
  else if (query.status !== "all") filter.status = { $in: OPEN_STATUSES };

  if (query.category) filter.category = query.category;
  if (query.barangay) {
    if (Types.ObjectId.isValid(query.barangay)) filter.barangayId = oid(query.barangay);
    else filter.barangayId = { $in: [] };
  }
  if (query.q) filter.title = { $regex: escapeRegex(query.q), $options: "i" };

  const total = await Issue.countDocuments(filter);

  // "Longest unfixed" is monotonic in reportedAt, so it needs no stored counter.
  const sortField = query.sort === "fixed" ? "fixedAt" : query.sort === "affected" ? "confirmations" : "reportedAt";
  const ascending = query.sort === "longest";
  if (query.sort === "fixed") {
    filter.fixedAt = { $ne: null };
  }

  const cursor = parseCursorValue(query.cursor);
  if (cursor) {
    const cmp = ascending ? "$gt" : "$lt";
    filter.$or = [
      { [sortField]: { [cmp]: cursor.at } },
      { [sortField]: cursor.at, _id: { [cmp]: oid(cursor.id) } },
    ];
  }

  const sort: Record<string, 1 | -1> = { [sortField]: ascending ? 1 : -1, _id: ascending ? 1 : -1 };

  const docs = await Issue.find(filter).sort(sort).limit(query.limit + 1).lean<IssueDoc[]>();
  const hasMore = docs.length > query.limit;
  const page = hasMore ? docs.slice(0, query.limit) : docs;
  const last = page.at(-1);

  const ctx: LocalsContext = {
    barangayNames: await getBarangayNames(),
    reporters: await getReporters(page.map((d) => String(d.reporterId))),
    now: new Date(),
  };

  return {
    items: page.map((doc) => toPublicIssue(doc, ctx)),
    total,
    nextCursor:
      hasMore && last
        ? `${new Date(cursorField(last, sortField)).toISOString()}|${String(last._id)}`
        : null,
  };
}

function cursorField(doc: IssueDoc, field: string): Date | number {
  if (field === "fixedAt") return doc.fixedAt ?? new Date(doc.reportedAt);
  if (field === "confirmations") return doc.confirmations;
  return new Date(doc.reportedAt);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getIssueBySlug(slug: string): Promise<PublicIssue | null> {
  await connectDb();
  const doc = await Issue.findOne({ slug }).lean<IssueDoc>();
  if (!doc) return null;
  const ctx: LocalsContext = {
    barangayNames: await getBarangayNames(),
    reporters: await getReporters([String(doc.reporterId)]),
    now: new Date(),
  };
  return toPublicIssue(doc, ctx);
}

export async function getIssueRaw(slug: string): Promise<IssueDoc | null> {
  await connectDb();
  return Issue.findOne({ slug }).lean<IssueDoc>();
}

export interface TimelineEntry {
  id: string;
  type: IssueUpdateDoc["type"];
  text: string;
  photos: IssueUpdateDoc["photos"];
  createdAt: string;
  authorName: string;
}

export async function getTimeline(issueId: string): Promise<TimelineEntry[]> {
  await connectDb();
  const rows = await IssueUpdate.find({ issueId: oid(issueId) })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean<IssueUpdateDoc[]>();

  const names = await getReporters(
    rows.map((r) => (r.authorId ? String(r.authorId) : "")).filter(Boolean),
  );

  return rows.map((r) => ({
    id: String(r._id),
    type: r.type,
    text: r.text,
    photos: r.photos ?? [],
    createdAt: new Date(r.createdAt).toISOString(),
    authorName: r.authorId
      ? (names.get(String(r.authorId))?.displayAlias ?? "Neighbor")
      : "Daet Watch",
  }));
}

export async function getNearbyOpenIssues(
  lat: number,
  lng: number,
  radiusM: number,
  category?: Category,
): Promise<PublicIssue[]> {
  await connectDb();
  const filter: Record<string, unknown> = {
    status: { $in: OPEN_STATUSES },
    mergedIntoId: null,
    location: {
      $nearSphere: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: radiusM,
      },
    },
  };
  if (category) filter.category = category;

  const docs = await Issue.find(filter).limit(5).lean<IssueDoc[]>();
  const ctx: LocalsContext = {
    barangayNames: await getBarangayNames(),
    reporters: await getReporters(docs.map((d) => String(d.reporterId))),
    now: new Date(),
  };
  return docs.map((d) => toPublicIssue(d, ctx));
}

export async function getLeaderboards() {
  await connectDb();
  const now = new Date();

  const [longest, mostAffected, recentlyFixed] = await Promise.all([
    Issue.find({ status: { $in: OPEN_STATUSES }, mergedIntoId: null })
      .sort({ reportedAt: 1 })
      .limit(10)
      .lean<IssueDoc[]>(),
    Issue.find({ status: { $in: OPEN_STATUSES }, mergedIntoId: null })
      .sort({ confirmations: -1, reportedAt: 1 })
      .limit(10)
      .lean<IssueDoc[]>(),
    Issue.find({ status: "fixed" })
      .sort({ fixedAt: -1 })
      .limit(10)
      .lean<IssueDoc[]>(),
  ]);

  const all = [...longest, ...mostAffected, ...recentlyFixed];
  const ctx: LocalsContext = {
    barangayNames: await getBarangayNames(),
    reporters: await getReporters(all.map((d) => String(d.reporterId))),
    now,
  };

  return {
    longest: longest.map((d) => toPublicIssue(d, ctx)),
    mostAffected: mostAffected.map((d) => toPublicIssue(d, ctx)),
    recentlyFixed: recentlyFixed.map((d) => toPublicIssue(d, ctx)),
  };
}

export interface WaterBoardRow {
  barangay: string;
  days: number;
  openIssues: number;
}

export async function getWaterData() {
  await connectDb();
  const [sources, names] = await Promise.all([WaterSource.find().limit(200).lean<WaterSourceDoc[]>(), getBarangayNames()]);

  const grouped = await Issue.aggregate<{ _id: MT.ObjectId; since: Date; count: number }>([
    { $match: { category: "water", status: { $in: [...OPEN_STATUSES] }, mergedIntoId: null } },
    { $group: { _id: "$barangayId", since: { $min: "$reportedAt" }, count: { $sum: 1 } } },
    { $sort: { since: 1 } },
    { $limit: 10 },
  ]);

  const now = new Date();
  const board: WaterBoardRow[] = grouped.map((row) => ({
    barangay: names.get(String(row._id)) ?? "Daet",
    days: daysUnfixed(row.since, now),
    openIssues: row.count,
  }));

  return {
    sources: sources.map((s) => ({
      id: String(s._id),
      name: s.name,
      type: s.type,
      barangay: names.get(String(s.barangayId)) ?? "Daet",
      status: s.status,
      lastConfirmedAt: s.lastConfirmedAt ? new Date(s.lastConfirmedAt).toISOString() : null,
      location: { lat: s.location.coordinates[1], lng: s.location.coordinates[0] },
    })),
    board,
  };
}

export async function getIssueCounts() {
  await connectDb();
  const [issues, open, fixed, hidden, water, flags, users, barangays] = await Promise.all([
    Issue.estimatedDocumentCount(),
    Issue.countDocuments({ status: { $in: OPEN_STATUSES } }),
    Issue.countDocuments({ status: "fixed" }),
    Issue.countDocuments({ status: "hidden" }),
    WaterSource.estimatedDocumentCount(),
    IssueUpdate.countDocuments(),
    User.estimatedDocumentCount(),
    Barangay.estimatedDocumentCount(),
  ]);
  return { issues, open, fixed, hidden, water, updates: flags, users, barangays };
}

export async function getMyIssues(userId: string): Promise<PublicIssue[]> {
  await connectDb();
  const docs = await Issue.find({ reporterId: oid(userId) })
    .sort({ reportedAt: -1 })
    .limit(20)
    .lean<IssueDoc[]>();

  const ctx: LocalsContext = {
    barangayNames: await getBarangayNames(),
    reporters: await getReporters([userId]),
    now: new Date(),
  };
  return docs.map((doc) => toPublicIssue(doc, ctx));
}

export async function countMyConfirmations(userId: string): Promise<number> {
  await connectDb();
  return Confirmation.countDocuments({ userId: oid(userId) });
}
