import mongoose, { Schema, Document } from 'mongoose';

export type ProductEventType = 'view' | 'cart_add' | 'purchase';

export interface IProductEvent extends Document {
  userId?: mongoose.Types.ObjectId | null;
  productId: mongoose.Types.ObjectId;
  eventType: ProductEventType;
  timestamp: Date;
}

const ProductEventSchema = new Schema<IProductEvent>(
  {
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
  },
  {
    collection: 'productEvents',
  }
);

// Compound Index: (userId, eventType, timestamp)
ProductEventSchema.index({ userId: 1, eventType: 1, timestamp: 1 });

// TTL Index: Expire events after 180 days (180 * 24 * 3600 seconds = 15,552,000 seconds)
ProductEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 15552000 });

export const ProductEvent = mongoose.model<IProductEvent>('ProductEvent', ProductEventSchema);
export default ProductEvent;
