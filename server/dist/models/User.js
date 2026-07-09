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
    addresses: [AddressSchema],
    isActive: { type: Boolean, default: true, required: true },
}, {
    timestamps: true,
    collection: 'users',
});
export const User = mongoose.model('User', UserSchema);
export default User;
