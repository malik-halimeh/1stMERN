import mongoose, { Schema, Document } from 'mongoose';

export interface IAddress {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  country: string;
  isDefault: boolean;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'customer' | 'inventory_manager' | 'super_admin';
  refreshTokenHash?: string | null;
  prevRefreshTokenHash?: string | null;
  prevRefreshTokenExpiresAt?: Date | null;
  addresses: IAddress[];
  isActive: boolean;
  // Email ownership verification (signup code flow). Defaults to true so
  // legacy/seeded accounts keep working; new signups explicitly set false
  // until the emailed code is confirmed.
  isEmailVerified: boolean;
  emailVerificationCodeHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
  // Password reset (forgot-password code flow), same shape as signup codes
  passwordResetCodeHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>({
  label: { type: String, trim: true },
  line1: { type: String, required: true, trim: true },
  line2: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['customer', 'inventory_manager', 'super_admin'],
      default: 'customer',
      required: true,
    },
    refreshTokenHash: { type: String, default: null },
    // Rotation grace: the previous refresh token stays valid for a short
    // window so concurrent refreshes (multiple tabs) don't trip reuse detection
    prevRefreshTokenHash: { type: String, default: null },
    prevRefreshTokenExpiresAt: { type: Date, default: null },
    addresses: [AddressSchema],
    isActive: { type: Boolean, default: true, required: true },
    isEmailVerified: { type: Boolean, default: true, required: true },
    emailVerificationCodeHash: { type: String, default: null },
    emailVerificationExpiresAt: { type: Date, default: null },
    passwordResetCodeHash: { type: String, default: null },
    passwordResetExpiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

export const User = mongoose.model<IUser>('User', UserSchema);
export default User;
