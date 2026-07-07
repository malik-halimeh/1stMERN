import mongoose, { Schema, Document } from 'mongoose';

export interface IProductRecommendation extends Document {
  productId: mongoose.Types.ObjectId;
  recommendedProductIds: mongoose.Types.ObjectId[];
  computedAt: Date;
}

const ProductRecommendationSchema = new Schema<IProductRecommendation>(
  {
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
  },
  {
    collection: 'productRecommendations',
  }
);

export const ProductRecommendation = mongoose.model<IProductRecommendation>(
  'ProductRecommendation',
  ProductRecommendationSchema
);
export default ProductRecommendation;
