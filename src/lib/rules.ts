/**
 * Pure business rules. No imports, no I/O, no dates read from the clock —
 * `now` is always passed in. That is what lets the day counter, the vote
 * threshold and the merge rule be tested without a database.
 */

export const CATEGORIES = [
  "water",
  "road",
  "drainage",
  "garbage",
  "streetlight",
  "electricity",
  "health",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const OPEN_STATUSES = ["reported", "confirmed", "unfixed", "reopened"] as const;
export const ISSUE_STATUSES = [...OPEN_STATUSES, "fixed", "hidden"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ROLES = ["resident", "moderator", "official"] as const;
export type Role = (typeof ROLES)[number];

export const FLAG_REASONS = [
  "spam",
  "false",
  "abusive",
  "personal_info",
  "duplicate",
  "other",
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

export const FIX_THRESHOLD = 3;
export const REOPEN_WINDOW_DAYS = 60;
export const DEDUPE_RADIUS_M = 100;
export const FLAGS_TO_HIDE = 3;
export const STALE_WATER_HOURS = 48;
export const MAX_PHOTOS = 4;

const DAY_MS = 86_400_000;

/** floor((now − reportedAt) / 24h), clamped at 0. Never stored. */
export function daysUnfixed(reportedAt: Date | string, now: Date | string): number {
  const a = typeof reportedAt === "string" ? new Date(reportedAt) : reportedAt;
  const b = typeof now === "string" ? new Date(now) : now;
  const diff = b.getTime() - a.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.floor(diff / DAY_MS);
}

/** Days a fixed issue took, counting the day it was reported as day 1. */
export function daysToFix(reportedAt: Date | string, fixedAt: Date | string): number {
  return Math.max(1, daysUnfixed(reportedAt, fixedAt));
}

export type DayTone = "neutral" | "amber" | "red";

/** 0–7 neutral, 8–30 amber, 31+ red. The one place those bands live. */
export function dayTone(days: number): DayTone {
  if (days >= 31) return "red";
  if (days >= 8) return "amber";
  return "neutral";
}

export function isOpen(status: IssueStatus): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}

/** 2 of 3 => "2 of 3 neighbors confirmed fixed". */
export function fixProgress(votes: number, threshold = FIX_THRESHOLD) {
  const clamped = Math.max(0, Math.min(votes, threshold));
  return {
    votes: clamped,
    target: threshold,
    remaining: Math.max(0, threshold - clamped),
    reached: clamped >= threshold,
    ratio: threshold === 0 ? 1 : clamped / threshold,
  };
}

export function reopenDeadline(fixedAt: Date | string, windowDays = REOPEN_WINDOW_DAYS): Date {
  const d = typeof fixedAt === "string" ? new Date(fixedAt) : fixedAt;
  return new Date(d.getTime() + windowDays * DAY_MS);
}

export function canReopen(
  fixedAt: Date | string | null | undefined,
  status: IssueStatus,
  now: Date | string,
  windowDays = REOPEN_WINDOW_DAYS,
): boolean {
  if (status !== "fixed" || !fixedAt) return false;
  const n = typeof now === "string" ? new Date(now) : now;
  return n.getTime() <= reopenDeadline(fixedAt, windowDays).getTime();
}

/** Should flags auto-hide this issue? */
export function shouldAutoHide(flagCount: number): boolean {
  return flagCount >= FLAGS_TO_HIDE;
}

export function waterIsStale(lastConfirmedAt: Date | string | null | undefined, now: Date | string) {
  if (!lastConfirmedAt) return true;
  const a = typeof lastConfirmedAt === "string" ? new Date(lastConfirmedAt) : lastConfirmedAt;
  const b = typeof now === "string" ? new Date(now) : now;
  return b.getTime() - a.getTime() > STALE_WATER_HOURS * 3_600_000;
}

export function hoursSince(then: Date | string | null | undefined, now: Date | string): number | null {
  if (!then) return null;
  const a = typeof then === "string" ? new Date(then) : then;
  const b = typeof now === "string" ? new Date(now) : now;
  const h = (b.getTime() - a.getTime()) / 3_600_000;
  return Number.isFinite(h) ? Math.max(0, Math.floor(h)) : null;
}

/** Merge keeps the OLDEST reportedAt so the counter never resets. */
export function mergeReportedAt(a: Date | string, b: Date | string): Date {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return da.getTime() <= db.getTime() ? da : db;
}

const EARTH_R = 6_371_000;

/** Metres between two [lng, lat] pairs. */
export function distanceMeters(
  a: [number, number],
  b: [number, number],
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

/** Milestone nudges at 7 / 30 / 60 / 100 days. */
export const MILESTONES = [7, 30, 60, 100] as const;

export function milestoneFor(days: number): number | null {
  return MILESTONES.find((m) => m === days) ?? null;
}
