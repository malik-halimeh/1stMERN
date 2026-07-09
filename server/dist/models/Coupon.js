import mongoose, { Schema } from 'mongoose';
const UsedBySchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    count: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
});
const CouponSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true,
    },
    value: {
        type: Number,
        required: true,
        min: [0, 'Coupon value cannot be negative.'],
    },
    minOrderValueCents: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
    },
    expiryDate: {
        type: Date,
        required: true,
    },
    usageLimit: {
        type: Number,
        required: true,
        min: [1, 'Usage limit must be at least 1.'],
    },
    perUserLimit: {
        type: Number,
        required: true,
        default: 1,
        min: [1, 'Per user limit must be at least 1.'],
    },
    usedBy: [UsedBySchema],
    isActive: {
        type: Boolean,
        default: true,
        required: true,
    },
}, {
    timestamps: true,
    collection: 'coupons',
});
// Pre-validate hook to normalize coupon codes to uppercase
CouponSchema.pre('validate', function (next) {
    if (this.code) {
        this.code = this.code.toUpperCase().trim();
    }
    next();
});
export const Coupon = mongoose.model('Coupon', CouponSchema);
export default Coupon;
