import { defineModel, Schema } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";

/**
 * Fixed-window counters that survive Vercel's frozen instances. An in-memory
 * limiter resets whenever the container is recycled, which is exactly when a
 * spammer retries — so the window lives in Mongo, keyed by
 * `${userId}:${action}`, and TTL cleans it up.
 */
export interface RateLimitDoc {
  _id: MT.ObjectId;
  key: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
}

const RateLimitSchema = new Schema<RateLimitDoc>(
  {
    key: { type: String, required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "ratelimits", versionKey: false },
);

RateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = defineModel<RateLimitDoc>("RateLimit", RateLimitSchema);
