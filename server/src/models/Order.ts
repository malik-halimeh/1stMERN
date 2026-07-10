import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  variantSku: string;
  unitPriceCents: number;
  unitCostCents: number;
  quantity: number;
}

export interface IStatusHistory {
  status: string;
  timestamp: Date;
  note?: string;
  updatedBy?: mongoose.Types.ObjectId;
}

export interface IRefund {
  status: string;
  reason: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  stripeRefundId?: string;
}

// Customer feedback about the order experience (delivery, service, etc.)
export interface IOrderFeedback {
  rating: number;
  text: string;
  createdAt: Date;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponCode?: string | null;
  shippingAddress: {
    label?: string;
    line1: string;
    line2?: string;
    city: string;
    country: string;
  };
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  statusHistory: IStatusHistory[];
  paymentIntentId?: string;
  paymentStatus: 'pending' | 'succeeded' | 'failed';
  refund?: IRefund | null;
  feedback?: IOrderFeedback | null;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  variantSku: {
    type: String,
    required: true,
  },
  unitPriceCents: {
    type: Number,
    required: true,
    min: 0,
  },
  unitCostCents: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
});

const StatusHistorySchema = new Schema<IStatusHistory>({
  status: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
  },
  note: {
    type: String,
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
});

const RefundSchema = new Schema<IRefund>({
  status: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  stripeRefundId: {
    type: String,
  },
});

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: [OrderItemSchema],
    subtotalCents: {
      type: Number,
      required: true,
      min: 0,
    },
    discountCents: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    totalCents: {
      type: Number,
      required: true,
      min: 0,
    },
    couponCode: {
      type: String,
      default: null,
    },
    shippingAddress: {
      label: { type: String, trim: true },
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
      required: true,
      index: true,
    },
    statusHistory: [StatusHistorySchema],
    paymentIntentId: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed'],
      default: 'pending',
      required: true,
    },
    refund: {
      type: RefundSchema,
      default: null,
    },
    feedback: {
      type: new Schema<IOrderFeedback>(
        {
          rating: { type: Number, required: true, min: 1, max: 5 },
          text: { type: String, required: true, trim: true, maxlength: 2000 },
          createdAt: { type: Date, default: Date.now, required: true },
        },
        { _id: false }
      ),
      default: null,
    },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'orders',
  }
);

// Compound Index: (status, createdAt)
OrderSchema.index({ status: 1, createdAt: 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
export default Order;
