import mongoose, { Schema } from 'mongoose';
const ProductEventSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    eventType: {
        type: String,
        enum: ['view', 'cart_add', 'purchase'],
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
    },
}, {
    collection: 'productEvents',
});
// Compound Index: (userId, eventType, timestamp)
ProductEventSchema.index({ userId: 1, eventType: 1, timestamp: 1 });
// TTL Index: Expire events after 180 days (180 * 24 * 3600 seconds = 15,552,000 seconds)
ProductEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 });
export const ProductEvent = mongoose.model('ProductEvent', ProductEventSchema);
export default ProductEvent;
