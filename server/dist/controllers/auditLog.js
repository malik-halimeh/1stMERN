import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import { AppError } from '../utils/errors.js';
// 1. GET /api/audit-logs - Super Admin Only, Read-Only
export const getAuditLogs = async (req, res, next) => {
    try {
        const { actorId, actionType, targetEntityId, startDate, endDate } = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const filter = {};
        if (actorId) {
            if (!mongoose.Types.ObjectId.isValid(actorId)) {
                throw new AppError('VALIDATION_FAILED', 'Invalid actor ID format.', 422);
            }
            filter.actorId = new mongoose.Types.ObjectId(actorId);
        }
        if (actionType) {
            filter.actionType = actionType;
        }
        if (targetEntityId) {
            if (!mongoose.Types.ObjectId.isValid(targetEntityId)) {
                throw new AppError('VALIDATION_FAILED', 'Invalid target entity ID format.', 422);
            }
            filter.targetEntityId = new mongoose.Types.ObjectId(targetEntityId);
        }
        // Date range filter
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) {
                filter.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                filter.timestamp.$lte = new Date(endDate);
            }
        }
        const total = await AuditLog.countDocuments(filter);
        const logs = await AuditLog.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ timestamp: -1 });
        res.status(200).json({
            success: true,
            data: logs,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit) || 1,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
