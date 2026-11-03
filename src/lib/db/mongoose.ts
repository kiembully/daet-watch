/**
 * The ONLY module that names `mongoose`'s exports.
 *
 * Mongoose ships CommonJS with no `exports` map. Under Node's real ESM loader
 * `import { Schema, model } from "mongoose"` can die with
 * "does not provide an export named 'Schema'" — while `next build` and tsc are
 * both perfectly happy. Destructuring the default export once, here, is what
 * makes the same code safe under Next, tsx (seed) and Vitest.
 */
import mongoose from "mongoose";

export const { Schema, model, models, Types } = mongoose;
export type { Model } from "mongoose";

const g = globalThis as unknown as {
  __daetWatchDb?: Promise<typeof mongoose>;
  __daetWatchConnectedOnce?: boolean;
};

export class DbUnavailableError extends Error {
  readonly code = "db_unavailable";
  constructor(message = "No database configured") {
    super(message);
  }
}

/**
 * Connect once per process, and REPAIR the cached promise when the driver has
 * dropped the socket (Vercel freezes functions between requests; Atlas closes
 * idle connections). Without the reset, every request in that container 503s
 * until the platform recycles it.
 */
export function connectDb(): Promise<typeof mongoose> {
  if (!process.env.MONGODB_URI) return Promise.reject(new DbUnavailableError());

  const state = mongoose.connection.readyState;
  if (state === 0 && g.__daetWatchConnectedOnce) {
    g.__daetWatchDb = undefined;
  }

  if (!g.__daetWatchDb) {
    g.__daetWatchDb = mongoose
      .connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB ?? "daet-watch",
        serverSelectionTimeoutMS: 6000,
        connectTimeoutMS: 8000,
        maxPoolSize: 5,
        retryWrites: true,
      })
      .then((m) => {
        g.__daetWatchConnectedOnce = true;
        return m;
      })
      .catch((err: unknown) => {
        g.__daetWatchDb = undefined;
        throw err;
      });
  }

  return g.__daetWatchDb;
}

/** 1 = connected, 2 = connecting, 0 = disconnected, 3 = disconnecting. */
export function dbState(): { readyState: number; dbName: string | null } {
  return {
    readyState: mongoose.connection.readyState,
    dbName: mongoose.connection.name ?? null,
  };
}

export function oid(value: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(value);
}

export function isValidObjectId(value: unknown): boolean {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

/** Model registry guard: Next bundles API modules into many routes, so the
 * second load in one process would throw OverwriteModelError. */
export function defineModel<T>(name: string, schema: mongoose.Schema<T>): mongoose.Model<T> {
  const existing = (models as Record<string, mongoose.Model<T> | undefined>)[name];
  return existing ?? model<T>(name, schema);
}
