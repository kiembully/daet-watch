import { z } from "zod";

import { CATEGORIES, FLAG_REASONS } from "@/lib/rules";
import { WATER_SOURCE_TYPES, WATER_STATUSES } from "@/models/water";

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Not a valid id");

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const photoSchema = z.object({
  url: z.url().startsWith("https://", "Photos must be served over https"),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
});

const title = z.string().trim().min(6, "Give it a slightly longer title").max(120);
const description = z.string().trim().min(15, "Tell us a bit more").max(2000);

export const createIssueSchema = z.object({
  title,
  description,
  category: z.enum(CATEGORIES),
  barangayId: objectIdSchema,
  location: geoPointSchema,
  addressText: z.string().trim().max(160).optional().or(z.literal("")),
  photos: z.array(photoSchema).min(1, "At least one photo is required").max(4),
  // `.nullable()` matters: the client always sends the key, and `null` for a
  // non-water report is the honest value — `.optional()` alone rejects it.
  waterDetails: z
    .object({
      outageStartedAt: z.coerce.date().nullable().optional(),
      householdsAffectedEstimate: z.number().int().min(0).max(100000).nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const listIssuesQuerySchema = z.object({
  sort: z.enum(["longest", "newest", "fixed", "affected"]).default("longest"),
  category: z.enum(CATEGORIES).optional(),
  barangay: z.string().trim().max(80).optional(),
  status: z.enum(["open", "fixed", "all"]).default("open"),
  cursor: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(24).default(10),
  q: z.string().trim().max(80).optional(),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  /** metres */
  radius: z.coerce.number().int().min(10).max(2000).default(100),
  category: z.enum(CATEGORIES).optional(),
});

export const fixVoteSchema = z.object({
  photoUrl: z.url().startsWith("https://").optional().nullable(),
  note: z.string().trim().max(300).optional(),
});

export const reopenSchema = z.object({
  reason: z.string().trim().min(10, "Say what is still broken").max(500),
  photoUrl: z.url().startsWith("https://").optional().nullable(),
});

export const flagSchema = z.object({
  reason: z.enum(FLAG_REASONS),
  note: z.string().trim().max(300).optional(),
  updateId: objectIdSchema.optional(),
});

export const addUpdateSchema = z
  .object({
    text: z.string().trim().max(1000).optional().default(""),
    type: z.enum(["update", "partial_fix"]).default("update"),
    photos: z.array(photoSchema).max(3).optional().default([]),
  })
  .refine((v) => v.text.length > 0 || v.photos.length > 0, {
    message: "Write something or attach a photo",
  });

export const shareEventSchema = z.object({
  channel: z.enum(["facebook", "messenger", "x", "copy", "download", "native", "other"]),
});

export const createWaterSourceSchema = z.object({
  name: z.string().trim().min(3).max(120),
  type: z.enum(WATER_SOURCE_TYPES),
  barangayId: objectIdSchema,
  location: geoPointSchema.optional(),
  status: z.enum(WATER_STATUSES).default("unknown"),
});

export const waterStatusSchema = z.object({
  status: z.enum(["has_water", "low", "empty"]),
});

export const truckReportSchema = z.object({
  barangayId: objectIdSchema,
  location: geoPointSchema.optional(),
  spottedAt: z.coerce.date().optional(),
  note: z.string().trim().max(200).optional(),
});

export const moderationActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("hide") }),
  z.object({ action: z.literal("unhide") }),
  z.object({ action: z.literal("merge"), targetId: objectIdSchema }),
  z.object({ action: z.literal("recategorise"), category: z.enum(CATEGORIES) }),
]);

export const profileUpdateSchema = z.object({
  displayAlias: z.string().trim().min(2).max(40).optional(),
  showName: z.boolean().optional(),
  barangayId: objectIdSchema.optional().nullable(),
});

export const signUploadSchema = z.object({
  folder: z.string().trim().max(40).optional(),
});
