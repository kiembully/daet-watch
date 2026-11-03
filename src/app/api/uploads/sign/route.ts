import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

import { ApiError, handler, item, requireUser } from "@/lib/api";
import { CLOUDINARY, CLOUDINARY_ENABLED } from "@/lib/env";
import { signUploadSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Cloudinary wants the signature over the exact params that will be posted, so
 * the client must send them back unchanged. Signing on the server keeps the API
 * secret out of the bundle while letting the browser upload the bytes directly —
 * which is the only way a multi-megabyte photo works on Vercel at all.
 */
export const POST = handler(async (request: NextRequest) => {
  await requireUser();

  if (!CLOUDINARY_ENABLED) {
    throw new ApiError(503, "storage_unavailable", "Photo uploads are not configured yet");
  }

  const body = signUploadSchema.parse(await request.json().catch(() => ({})));
  const folder = body.folder
    ? `${CLOUDINARY.folder}/${sanitise(body.folder)}`
    : `${CLOUDINARY.folder}/reports`;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${CLOUDINARY.apiSecret}`)
    .digest("hex");

  return item({
    cloudName: CLOUDINARY.cloudName,
    apiKey: CLOUDINARY.apiKey,
    timestamp,
    folder,
    signature,
  });
});

function sanitise(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "reports";
}
