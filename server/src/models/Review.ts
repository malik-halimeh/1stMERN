import mongoose, { Schema, Document } from 'mongoose';

export interface IReviewImage {
  url: string;
  publicId: string;
}

export interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  rating: number;
  text: string;
  images: IReviewImage[];
  isFlagged: boolean;
  isRemoved: boolean;
  createdAt: Date;
  editedAt?: Date;
}

const ReviewImageSchema = new Schema<IReviewImage>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
});

const ReviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true, // Proof of purchase
    },
    rating: {
      type: Number,
      required: true,
      min: [1, 'Rating must be at least 1.'],
      max: [5, 'Rating cannot exceed 5.'],
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    images: [ReviewImageSchema],
    isFlagged: {
      type: Boolean,
      default: false,
      required: true,
    },
    isRemoved: {
      type: Boolean,
      default: false,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    editedAt: {
      type: Date,
    },
  },
  {
    collection: 'reviews',
  }
);

// Compound Unique Index: One review per user per product
ReviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
export default Review;
