import mongoose from 'mongoose';
import LowStockAlert from '../models/LowStockAlert.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';
// 1. GET /api/low-stock - Inventory Manager Only
export const getLowStockAlerts = async (req, res, next) => {
    try {
        const { status } = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const filter = {};
        if (status === 'active' || status === 'resolved') {
            filter.status = status;
        }
        const total = await LowStockAlert.countDocuments(filter);
        const alerts = await LowStockAlert.find(filter)
            .populate('productId', 'name basePriceCents variants')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: alerts,
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
// 2. PATCH /api/low-stock/:id/resolve - Inventory Manager Only
export const resolveLowStockAlert = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
        }
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid alert ID format.', 422);
        }
        const alert = await LowStockAlert.findById(id);
        if (!alert) {
            throw new AppError('ALERT_NOT_FOUND', 'Low stock alert not found.', 404);
        }
        if (alert.status === 'resolved') {
            throw new AppError('ALERT_ALREADY_RESOLVED', 'This stock alert has already been resolved.', 400);
        }
        const beforeData = JSON.parse(JSON.stringify(alert.toObject()));
        // Mark status as resolved
        alert.status = 'resolved';
        alert.resolvedAt = new Date();
        await alert.save();
        // Write Audit Log
        const actor = await User.findById(req.user.userId);
        await AuditLog.create({
            actorId: new mongoose.Types.ObjectId(req.user.userId),
            actorName: actor?.name || 'Inventory Manager',
            actionType: 'stock_update',
            targetEntityType: 'LowStockAlert',
            targetEntityId: alert._id,
            changeDelta: {
                before: beforeData,
                after: alert.toObject(),
            },
        });
        res.status(200).json({
            success: true,
            data: alert,
        });
    }
    catch (error) {
        next(error);
    }
};
