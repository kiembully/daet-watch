import { defineModel, Schema } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";

export interface BarangayDoc {
  _id: MT.ObjectId;
  name: string;
  psgcCode: string;
  municipality: string;
  province: string;
  centroid: { type: "Point"; coordinates: [number, number] };
  areaSqkm: number | null;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BarangaySchema = new Schema<BarangayDoc>(
  {
    name: { type: String, required: true, trim: true, index: true },
    psgcCode: { type: String, required: true, trim: true },
    municipality: { type: String, default: "Daet" },
    province: { type: String, default: "Camarines Norte" },
    centroid: { type: Schema.Types.Mixed, required: true },
    areaSqkm: { type: Number, default: null },
    // The seed list came from PSA PSGC 2023 boundaries (via BetterGov.ph). It is
    // flagged unverified until a human checks it against the LGU's own list.
    verified: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "barangays" },
);

BarangaySchema.index({ psgcCode: 1 }, { unique: true });
BarangaySchema.index({ centroid: "2dsphere" });

export const Barangay = defineModel<BarangayDoc>("Barangay", BarangaySchema);
