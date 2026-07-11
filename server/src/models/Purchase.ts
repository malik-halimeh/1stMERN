import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchase extends Document {
  productId: mongoose.Types.ObjectId;
  /** Snapshot so the row survives product deletion (same pattern as AuditLog.actorName) */
  productName: string;
  variantSku: string;
  quantity: number;
  unitCostCents: number;
  /** quantity * unitCostCents, precomputed for aggregations */
  totalCostCents: number;
  note?: string;
  createdBy: mongoose.Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productName: { type: String, required: true, trim: true },
    variantSku: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCostCents: { type: Number, required: true, min: 0 },
    totalCostCents: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    collection: 'purchases',
  }
);

// List sort + month-summary + analytics range scans
PurchaseSchema.index({ createdAt: -1 });

export const Purchase = mongoose.model<IPurchase>('Purchase', PurchaseSchema);
export default Purchase;
