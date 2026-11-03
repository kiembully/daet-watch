import { defineModel, Schema } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";
import type { GeoPoint } from "./issue";

export const WATER_SOURCE_TYPES = [
  "refill_station",
  "deep_well",
  "spring",
  "public_tap",
  "other",
] as const;
export type WaterSourceType = (typeof WATER_SOURCE_TYPES)[number];

export const WATER_STATUSES = ["has_water", "low", "empty", "unknown"] as const;
export type WaterStatus = (typeof WATER_STATUSES)[number];

export interface WaterConfirmation {
  userId: MT.ObjectId;
  status: WaterStatus;
  at: Date;
}

export interface WaterSourceDoc {
  _id: MT.ObjectId;
  name: string;
  type: WaterSourceType;
  location: GeoPoint;
  barangayId: MT.ObjectId;
  status: WaterStatus;
  lastConfirmedAt: Date | null;
  confirmations: WaterConfirmation[];
  createdBy: MT.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const WaterSourceSchema = new Schema<WaterSourceDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: WATER_SOURCE_TYPES, required: true },
    location: { type: Schema.Types.Mixed, required: true },
    barangayId: { type: Schema.Types.ObjectId, ref: "Barangay", required: true },
    status: { type: String, enum: WATER_STATUSES, default: "unknown" },
    lastConfirmedAt: { type: Date, default: null },
    confirmations: { type: Schema.Types.Mixed, default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, collection: "watersources" },
);
WaterSourceSchema.index({ location: "2dsphere" });
WaterSourceSchema.index({ barangayId: 1, status: 1, lastConfirmedAt: -1 });

export const WaterSource = defineModel<WaterSourceDoc>("WaterSource", WaterSourceSchema);

export interface WaterTruckReportDoc {
  _id: MT.ObjectId;
  barangayId: MT.ObjectId;
  location: GeoPoint | null;
  spottedAt: Date;
  reportedBy: MT.ObjectId | null;
  note: string | null;
  createdAt: Date;
}

const WaterTruckReportSchema = new Schema<WaterTruckReportDoc>(
  {
    barangayId: { type: Schema.Types.ObjectId, ref: "Barangay", required: true },
    location: { type: Schema.Types.Mixed, default: null },
    spottedAt: { type: Date, required: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: null, trim: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "watertruckreports" },
);
WaterTruckReportSchema.index({ barangayId: 1, spottedAt: -1 });

export const WaterTruckReport = defineModel<WaterTruckReportDoc>(
  "WaterTruckReport",
  WaterTruckReportSchema,
);
