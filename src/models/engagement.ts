import { defineModel, Schema } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";
import { FLAG_REASONS } from "@/lib/rules";
import type { IssuePhoto } from "./issue";

/**
 * Engagement is stored as its own collection with a UNIQUE index per person per
 * issue. "One account, one vote" is then a database constraint rather than an
 * `if` statement that a race can slip past; the counters on `Issue` are the
 * denormalised read path.
 */

export interface ConfirmationDoc {
  _id: MT.ObjectId;
  issueId: MT.ObjectId;
  userId: MT.ObjectId;
  createdAt: Date;
}

const ConfirmationSchema = new Schema<ConfirmationDoc>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "confirmations" },
);
ConfirmationSchema.index({ issueId: 1, userId: 1 }, { unique: true });
ConfirmationSchema.index({ userId: 1, createdAt: -1 });

export const Confirmation = defineModel<ConfirmationDoc>("Confirmation", ConfirmationSchema);

export interface FixVoteDoc {
  _id: MT.ObjectId;
  issueId: MT.ObjectId;
  userId: MT.ObjectId;
  /** Vote cycles: round 0 is the first fix, incrementing on every reopen. */
  round: number;
  photoUrl: string | null;
  createdAt: Date;
}

const FixVoteSchema = new Schema<FixVoteDoc>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    round: { type: Number, default: 0, min: 0 },
    photoUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "fixvotes" },
);
FixVoteSchema.index({ issueId: 1, userId: 1, round: 1 }, { unique: true });

export const FixVote = defineModel<FixVoteDoc>("FixVote", FixVoteSchema);

export interface ReopenVoteDoc {
  _id: MT.ObjectId;
  issueId: MT.ObjectId;
  userId: MT.ObjectId;
  round: number;
  reason: string;
  photoUrl: string | null;
  createdAt: Date;
}

const ReopenVoteSchema = new Schema<ReopenVoteDoc>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    round: { type: Number, default: 1, min: 1 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    photoUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "reopenvotes" },
);
ReopenVoteSchema.index({ issueId: 1, userId: 1, round: 1 }, { unique: true });

export const ReopenVote = defineModel<ReopenVoteDoc>("ReopenVote", ReopenVoteSchema);

export type FlagReason = (typeof FLAG_REASONS)[number];

export interface FlagDoc {
  _id: MT.ObjectId;
  issueId: MT.ObjectId;
  updateId: MT.ObjectId | null;
  userId: MT.ObjectId;
  reason: FlagReason;
  note: string | null;
  resolvedBy: MT.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

const FlagSchema = new Schema<FlagDoc>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    updateId: { type: Schema.Types.ObjectId, ref: "IssueUpdate", default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: FLAG_REASONS, required: true },
    note: { type: String, default: null, trim: true, maxlength: 300 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "flags" },
);
FlagSchema.index({ issueId: 1, userId: 1 }, { unique: true });
FlagSchema.index({ resolvedAt: 1, createdAt: -1 });

export const Flag = defineModel<FlagDoc>("Flag", FlagSchema);

export type UpdateType =
  | "reported"
  | "confirmed"
  | "update"
  | "partial_fix"
  | "fixed"
  | "reopened"
  | "merged"
  | "moderation"
  | "official_response";

export const UPDATE_TYPES: readonly UpdateType[] = [
  "reported",
  "confirmed",
  "update",
  "partial_fix",
  "fixed",
  "reopened",
  "merged",
  "moderation",
  "official_response",
];

export interface IssueUpdateDoc {
  _id: MT.ObjectId;
  issueId: MT.ObjectId;
  authorId: MT.ObjectId | null;
  type: UpdateType;
  text: string;
  photos: IssuePhoto[];
  createdAt: Date;
}

const IssueUpdateSchema = new Schema<IssueUpdateDoc>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: UPDATE_TYPES, required: true },
    text: { type: String, default: "", trim: true, maxlength: 1000 },
    photos: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "issueupdates" },
);
IssueUpdateSchema.index({ issueId: 1, createdAt: 1 });

export const IssueUpdate = defineModel<IssueUpdateDoc>("IssueUpdate", IssueUpdateSchema);

export interface ShareEventDoc {
  _id: MT.ObjectId;
  issueId: MT.ObjectId;
  channel: string;
  createdAt: Date;
}

const ShareEventSchema = new Schema<ShareEventDoc>(
  {
    issueId: { type: Schema.Types.ObjectId, ref: "Issue", required: true },
    channel: { type: String, required: true, maxlength: 40 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "shareevents" },
);
ShareEventSchema.index({ issueId: 1, createdAt: -1 });

export const ShareEvent = defineModel<ShareEventDoc>("ShareEvent", ShareEventSchema);
