import { defineModel, Schema } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";
import { CATEGORIES, ISSUE_STATUSES, type Category, type IssueStatus } from "@/lib/rules";

export interface IssuePhoto {
  url: string;
  width: number;
  height: number;
}

export interface WaterDetails {
  outageStartedAt: Date | null;
  householdsAffectedEstimate: number | null;
}

export interface GeoPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface IssueDoc {
  _id: MT.ObjectId;
  slug: string;
  title: string;
  description: string;
  category: Category;
  barangayId: MT.ObjectId;
  location: GeoPoint;
  addressText: string | null;
  photos: IssuePhoto[];
  reporterId: MT.ObjectId;
  /** Server-set only. Never accepted from a request body. */
  reportedAt: Date;
  status: IssueStatus;
  confirmations: number;
  fixVotes: number;
  fixThreshold: number;
  fixedAt: Date | null;
  reopenedAt: Date | null;
  reopenCount: number;
  mergedIntoId: MT.ObjectId | null;
  flagCount: number;
  waterDetails: WaterDetails | null;
  createdAt: Date;
  updatedAt: Date;
}

const PhotoSchema = new Schema<IssuePhoto>(
  {
    url: { type: String, required: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const IssueSchema = new Schema<IssueDoc>(
  {
    slug: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, required: true },
    barangayId: { type: Schema.Types.ObjectId, ref: "Barangay", required: true },
    // GeoJSON Point, validated by zod at the edge. Mixed is deliberate: Mongoose's
    // field typing for a nested geometry object fights the generic, and the shape
    // is enforced in one place (schemas.ts) plus the 2dsphere index itself.
    location: { type: Schema.Types.Mixed, required: true },
    addressText: { type: String, default: null, trim: true, maxlength: 160 },
    photos: { type: [PhotoSchema], default: [] },
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportedAt: { type: Date, required: true },
    status: { type: String, enum: ISSUE_STATUSES, default: "reported" },
    confirmations: { type: Number, default: 0, min: 0 },
    fixVotes: { type: Number, default: 0, min: 0 },
    fixThreshold: { type: Number, default: 3, min: 1 },
    fixedAt: { type: Date, default: null },
    reopenedAt: { type: Date, default: null },
    reopenCount: { type: Number, default: 0, min: 0 },
    mergedIntoId: { type: Schema.Types.ObjectId, ref: "Issue", default: null },
    flagCount: { type: Number, default: 0, min: 0 },
    waterDetails: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: "issues" },
);

IssueSchema.index({ slug: 1 }, { unique: true });
IssueSchema.index({ location: "2dsphere" });
IssueSchema.index({ status: 1, reportedAt: 1 });
IssueSchema.index({ barangayId: 1, status: 1, reportedAt: -1 });
IssueSchema.index({ category: 1, status: 1 });
IssueSchema.index({ mergedIntoId: 1 });
IssueSchema.index({ reporterId: 1, reportedAt: -1 });
IssueSchema.index({ flagCount: -1, updatedAt: -1 });

export const Issue = defineModel<IssueDoc>("Issue", IssueSchema);
