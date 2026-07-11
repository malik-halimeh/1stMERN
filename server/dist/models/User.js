import mongoose, { Schema } from 'mongoose';
const AddressSchema = new Schema({
    label: { type: String, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    isDefault: { type: Boolean, default: false },
});
const UserSchema = new Schema({
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
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
        required: true,
    },
}, {
    timestamps: true,
    collection: 'users',
});
export const User = mongoose.model('User', UserSchema);
export default User;
