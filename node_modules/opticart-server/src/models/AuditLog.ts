import mongoose, { Schema, Document } from 'mongoose';

export type AuditActionType =
  | 'stock_update'
  | 'order_status_change'
  | 'refund_decision'
  | 'role_change'
  | 'account_status_change'
  | 'coupon_cud'
  | 'review_removal';

export interface IAuditLog extends Document {
  actorId: mongoose.Types.ObjectId;
  actorName: string;
  actionType: AuditActionType;
  targetEntityType: string;
  targetEntityId: mongoose.Types.ObjectId;
  changeDelta: {
    before: Schema.Types.Mixed;
    after: Schema.Types.Mixed;
  };
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    actionType: {
      type: String,
      enum: [
        'stock_update',
        'order_status_change',
        'refund_decision',
        'role_change',
        'account_status_change',
        'coupon_cud',
        'review_removal',
      ],
      required: true,
    },
    targetEntityType: {
      type: String,
      required: true,
      trim: true,
    },
    targetEntityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    changeDelta: {
      before: { type: Schema.Types.Mixed, default: null },
      after: { type: Schema.Types.Mixed, default: null },
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    collection: 'auditLogs',
  }
);

// Append-only rule enforcement: Throw errors on any modification queries
const blockModification = function (this: any, next: (err?: Error) => void) {
  next(new Error('Audit logs are append-only. Modifications or deletions are strictly prohibited.'));
};

AuditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Audit logs are append-only. Updates are strictly prohibited.'));
  }
  next();
});

AuditLogSchema.pre('updateOne', blockModification);
AuditLogSchema.pre('updateMany', blockModification);
AuditLogSchema.pre('findOneAndUpdate', blockModification);
AuditLogSchema.pre('deleteOne', blockModification);
AuditLogSchema.pre('deleteMany', blockModification);
AuditLogSchema.pre('findOneAndDelete', blockModification);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;
