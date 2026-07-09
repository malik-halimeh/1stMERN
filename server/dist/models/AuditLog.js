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
            'order_status_change',
            'refund_decision',
            'role_change',
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
}, {
    collection: 'auditLogs',
});
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
