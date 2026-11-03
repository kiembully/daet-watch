import { defineModel, Schema } from "@/lib/db/mongoose";
import type { Types as MT } from "mongoose";
import { ROLES, type Role } from "@/lib/rules";

export interface UserDoc {
  _id: MT.ObjectId;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  phone: string | null;
  role: Role;
  barangayId: MT.ObjectId | null;
  displayAlias: string;
  showName: boolean;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, default: null, trim: true, maxlength: 80 },
    email: { type: String, default: null, lowercase: true, trim: true },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },
    phone: { type: String, default: null, trim: true },
    role: { type: String, enum: ROLES, default: "resident", index: true },
    barangayId: { type: Schema.Types.ObjectId, ref: "Barangay", default: null },
    displayAlias: { type: String, required: true, trim: true, maxlength: 40 },
    showName: { type: Boolean, default: false },
    trustScore: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "users" },
);

// An account may have an email, a phone, or both. `sparse` is NOT enough here:
// it only skips documents where the field is MISSING, and we store `null` for the
// credential the person did not use — every phone-only user then collides on
// `email: null`. A partial index on the TYPE is what actually keeps uniqueness.
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
UserSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);

export const User = defineModel<UserDoc>("User", UserSchema);
