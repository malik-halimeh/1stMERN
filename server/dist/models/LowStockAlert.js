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
// Partial unique index: at most ONE active alert per variant, while any number
// of resolved alerts may accumulate over repeated low-stock/restock cycles.
// (A plain unique index on {productId, variantSku, status} would also cap
// resolved docs at one per variant, making the second resolve throw E11000.)
LowStockAlertSchema.index({ productId: 1, variantSku: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
export const LowStockAlert = mongoose.model('LowStockAlert', LowStockAlertSchema);
export default LowStockAlert;
