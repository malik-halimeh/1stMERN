import mongoose, { Schema } from 'mongoose';
const LowStockAlertSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true,
    },
    variantSku: {
        type: String,
        required: true,
        trim: true,
    },
    thresholdAtTrigger: {
        type: Number,
        required: true,
        min: 0,
    },
    currentStock: {
        type: Number,
        required: true,
        min: 0,
    },
    status: {
        type: String,
        enum: ['active', 'resolved'],
        default: 'active',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
    resolvedAt: {
        type: Date,
    },
}, {
    collection: 'lowStockAlerts',
});
// Compound Index: Enforce one active alert per variant
// (status: 1 is used in compound constraint to allow multiple 'resolved' alerts,
// but only one 'active' alert. In MongoDB, if status is 'active', the unique index blocks duplicates).
LowStockAlertSchema.index({ productId: 1, variantSku: 1, status: 1 }, { unique: true });
export const LowStockAlert = mongoose.model('LowStockAlert', LowStockAlertSchema);
export default LowStockAlert;
