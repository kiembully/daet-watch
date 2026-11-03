/**
 * Server environment. Read once, here, so a missing variable produces one
 * legible message instead of an undefined deep inside a query.
 *
 * NOTHING in this file may be imported by a client component: it reads the
 * server's secrets. Client-visible values live in `src/lib/public-env.ts`.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

export const MONGODB_URI = process.env.MONGODB_URI ?? "";
export const MONGODB_DB = process.env.MONGODB_DB ?? "daet-watch";

export const CLOUDINARY = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  apiKey: process.env.CLOUDINARY_API_KEY ?? "",
  apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  folder: process.env.CLOUDINARY_FOLDER ?? "daet-watch",
};

export const CLOUDINARY_ENABLED = Boolean(
  CLOUDINARY.cloudName && CLOUDINARY.apiKey && CLOUDINARY.apiSecret,
);

export const DEMO_LOGIN_ENABLED = process.env.ENABLE_DEMO_LOGIN === "1";

export const MODERATOR_EMAILS = (process.env.MODERATOR_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const LIMITS = {
  reportsPerDay: numberFromEnv("RATE_LIMIT_REPORTS_PER_DAY", 5),
  confirmsPerDay: numberFromEnv("RATE_LIMIT_CONFIRMS_PER_DAY", 20),
  flagsPerDay: numberFromEnv("RATE_LIMIT_FLAGS_PER_DAY", 10),
};

export const PUSH_ENABLED = process.env.NEXT_PUBLIC_PUSH_ENABLED === "1";

function numberFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  const n = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Which integrations are actually configured — used by /api/health and /status. */
export function integrationStatus() {
  return {
    database: Boolean(MONGODB_URI),
    cloudinary: CLOUDINARY_ENABLED,
    google: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    facebook: Boolean(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET),
    demoLogin: DEMO_LOGIN_ENABLED,
    push: PUSH_ENABLED,
  };
}
