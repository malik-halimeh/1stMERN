import mongoose, { Schema } from 'mongoose';
const ProductRecommendationSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        unique: true,
        index: true,
    },
    recommendedProductIds: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Product',
        },
    ],
    computedAt: {
        type: Date,
        default: Date.now,
        required: true,
    },
}, {
    collection: 'productRecommendations',
});
export const ProductRecommendation = mongoose.model('ProductRecommendation', ProductRecommendationSchema);
export default ProductRecommendation;
