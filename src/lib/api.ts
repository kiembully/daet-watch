import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auth } from "@/auth";
import { DbUnavailableError } from "@/lib/db/mongoose";
import { RateLimit } from "@/models/system";
import type { Role } from "@/lib/rules";

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Every response is one of: {item} | {items,total,nextCursor} | {ok} | {error}. */
export function item<T>(data: T, status = 200) {
  return NextResponse.json({ item: data }, { status });
}

export function list<T>(items: T[], total: number, nextCursor: string | null = null) {
  return NextResponse.json({ items, total, nextCursor });
}

export function ok(extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...extra });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json<ErrorBody>({ error: { code, message, details } }, { status });
}

/**
 * Wraps a handler so every failure mode has one shape: validation is 422,
 * auth is 401/403, a missing database is 503 (never a 500), unknown errors are
 * logged once server-side and answered generically.
 */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ZodError) {
        return fail(422, "validation_error", "Check the highlighted fields", error.issues);
      }
      if (error instanceof ApiError) {
        return fail(error.status, error.code, error.message);
      }
      if (error instanceof DbUnavailableError) {
        return fail(503, "db_unavailable", "The database is not configured or unreachable");
      }
      if (isDuplicateKey(error)) {
        return fail(409, "duplicate", "That action was already recorded");
      }
      console.error("[api]", error);
      const message = error instanceof Error ? error.message : "Unexpected error";
      return fail(500, "server_error", message);
    }
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export interface SessionUser {
  id: string;
  role: Role;
  email: string | null;
  name: string | null;
}

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as (SessionUser & { id?: string }) | undefined;
  if (!user?.id) return null;
  return { id: user.id, role: user.role ?? "resident", email: user.email ?? null, name: user.name ?? null };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Sign in to do that");
  return user;
}

export async function requireModerator(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "moderator" && user.role !== "official") {
    throw new ApiError(403, "forbidden", "Moderators only");
  }
  return user;
}

/**
 * Fixed-window limiter in Mongo. Keyed on `${userId}:${action}` because a limit
 * keyed on the action alone would put every resident in one bucket.
 */
export async function rateLimit(
  userId: string,
  action: string,
  limit: number,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 86_400_000) * 86_400_000);
  const key = `${userId}:${action}`;

  const row = await RateLimit.findOneAndUpdate(
    { key, windowStart },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(windowStart.getTime() + 2 * 86_400_000) },
    },
    { upsert: true, returnDocument: "after" },
  ).lean<{ count: number } | null>();

  const count = row?.count ?? 1;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), limit };
}

export async function enforceRateLimit(userId: string, action: string, limit: number) {
  const result = await rateLimit(userId, action, limit);
  if (!result.allowed) {
    throw new ApiError(429, "rate_limited", `Too many attempts. Try again tomorrow (limit ${limit}/day)`);
  }
  return result;
}

const PROFANITY = ["putang ina", "putangina", "gago", "tanga", "bobo", "ulol", "tarantado"];

/**
 * Content safety hook. Descriptions are plain text: HTML is stripped rather
 * than escaped (we never render user HTML anywhere), links are capped so a
 * report cannot be an SEO payload, and the profanity list is deliberately
 * short and extendable — a blocklist is a policy surface, not a validator.
 */
export function screenText(input: string): string {
  let text = input
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const links = text.match(/https?:\/\//gi)?.length ?? 0;
  if (links > 2) text = text.replace(/https?:\/\/\S+/gi, "[link removed]");

  const lower = text.toLowerCase();
  for (const word of PROFANITY) {
    if (lower.includes(word)) {
      text = text.replace(new RegExp(word, "gi"), "…");
    }
  }
  return text;
}

/** Cursor pagination on a stable sort key: "<isoDate>|<id>". */
export function parseCursor(cursor?: string | null): { at: Date; id: string } | null {
  if (!cursor) return null;
  const [at, id] = cursor.split("|");
  if (!at || !id) return null;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  return { at: date, id };
}

export function makeCursor(date: Date, id: string): string {
  return `${date.toISOString()}|${id}`;
}
