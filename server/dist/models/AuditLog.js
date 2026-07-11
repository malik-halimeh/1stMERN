import mongoose, { Schema } from 'mongoose';
const AuditLogSchema = new Schema({
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
            'stock_purchase',
            'order_status_change',
            'refund_decision',
            'role_change',
            'account_status_change',
            'coupon_cud',
            'review_removal',
            'user_delete',
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
}, {
    collection: 'auditLogs',
});
// Query-path indexes: GET /audit-logs filters by actor, action type, and
// target entity (controllers/auditLog.ts) — without these every filtered
// page is a collection scan on an ever-growing append-only collection.
AuditLogSchema.index({ actorId: 1 });
AuditLogSchema.index({ actionType: 1 });
AuditLogSchema.index({ targetEntityId: 1 });
// Append-only rule enforcement: Throw errors on any modification queries
const blockModification = function (next) {
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
export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;
