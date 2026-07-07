import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';
// 1. POST /api/coupons/apply - Customer Only
export const applyCoupon = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('AUTH_UNAUTHORIZED', 'Customer session is not authenticated.', 401);
        }
        const { code, cartSubtotalCents } = req.body;
        const subtotal = parseInt(cartSubtotalCents);
        if (!code || isNaN(subtotal) || subtotal < 0) {
            throw new AppError('VALIDATION_FAILED', 'Coupon code and non-negative cart subtotal are required.', 422);
        }
        const normalizedCode = code.toUpperCase().trim();
        const coupon = await Coupon.findOne({ code: normalizedCode });
        if (!coupon) {
            throw new AppError('COUPON_NOT_FOUND', 'Invalid or unrecognized coupon code.', 404);
        }
        // A. Validate Activation
        if (!coupon.isActive) {
            throw new AppError('COUPON_INACTIVE', 'This coupon code has been deactivated.', 400);
        }
        // B. Validate Expiration
        if (new Date(coupon.expiryDate) < new Date()) {
            throw new AppError('COUPON_EXPIRED', 'This coupon code has expired.', 400);
        }
        // C. Validate Order Subtotal
        if (subtotal < coupon.minOrderValueCents) {
            const minValDollars = (coupon.minOrderValueCents / 100).toFixed(2);
            throw new AppError('COUPON_MIN_ORDER_LIMIT', `Minimum order subtotal of $${minValDollars} is required to apply this coupon.`, 400);
        }
        // D. Validate Global Usage Limit
        const totalUsages = coupon.usedBy.reduce((acc, curr) => acc + curr.count, 0);
        if (totalUsages >= coupon.usageLimit) {
            throw new AppError('COUPON_LIMIT_EXCEEDED', 'This coupon has reached its maximum global usage limit.', 400);
        }
        // E. Validate Per-User Limit
        const userUsage = coupon.usedBy.find((u) => u.userId.toString() === req.user?.userId);
        if (userUsage && userUsage.count >= coupon.perUserLimit) {
            throw new AppError('COUPON_USER_LIMIT_EXCEEDED', 'You have already reached the maximum usage limit for this coupon.', 400);
        }
        // F. Calculate Discount Amount
        let discountCents = 0;
        if (coupon.type === 'percentage') {
            // Coupon value is percentage (e.g. 15 for 15%)
            discountCents = Math.round(subtotal * (coupon.value / 100));
        }
        else if (coupon.type === 'fixed') {
            // Coupon value is fixed value in cents
            discountCents = coupon.value;
        }
        // Cap discount at subtotal to prevent negative totals
        discountCents = Math.min(discountCents, subtotal);
        res.status(200).json({
            success: true,
            data: {
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
                discountCents,
            },
        });
    }
    catch (error) {
        next(error);
    }
};
// 2. GET /api/coupons - Inventory Manager Only
export const getCoupons = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const total = await Coupon.countDocuments();
        const coupons = await Coupon.find().skip(skip).limit(limit).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: coupons,
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
// 3. POST /api/coupons - Inventory Manager Only
export const createCoupon = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
        }
        const { code, type, value, minOrderValueCents, expiryDate, usageLimit, perUserLimit, isActive } = req.body;
        if (!code || !type || value === undefined || !expiryDate || !usageLimit) {
            throw new AppError('VALIDATION_FAILED', 'Missing required parameters for coupon creation.', 422);
        }
        if (type !== 'percentage' && type !== 'fixed') {
            throw new AppError('VALIDATION_FAILED', 'Coupon type must be fixed or percentage.', 422);
        }
        const numericValue = parseFloat(value);
        const minOrderVal = parseInt(minOrderValueCents || 0);
        const limit = parseInt(usageLimit);
        const userLimit = parseInt(perUserLimit || 1);
        if (isNaN(numericValue) || numericValue < 0 || isNaN(minOrderVal) || minOrderVal < 0 || isNaN(limit) || limit <= 0 || isNaN(userLimit) || userLimit <= 0) {
            throw new AppError('VALIDATION_FAILED', 'Numeric inputs must be valid positive boundaries.', 422);
        }
        const coupon = await Coupon.create({
            code,
            type,
            value: numericValue,
            minOrderValueCents: minOrderVal,
            expiryDate: new Date(expiryDate),
            usageLimit: limit,
            perUserLimit: userLimit,
            isActive: isActive !== undefined ? !!isActive : true,
            usedBy: [],
        });
        // Write Audit Log
        const actor = await User.findById(req.user.userId);
        await AuditLog.create({
            actorId: new mongoose.Types.ObjectId(req.user.userId),
            actorName: actor?.name || 'Inventory Manager',
            actionType: 'coupon_cud',
            targetEntityType: 'Coupon',
            targetEntityId: coupon._id,
            changeDelta: {
                before: null,
                after: coupon.toObject(),
            },
        });
        res.status(201).json({
            success: true,
            data: coupon,
        });
    }
    catch (error) {
        next(error);
    }
};
// 4. PATCH /api/coupons/:id - Inventory Manager Only
export const updateCoupon = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
        }
        const { id } = req.params;
        const { code, type, value, minOrderValueCents, expiryDate, usageLimit, perUserLimit, isActive } = req.body;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid coupon ID format.', 422);
        }
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            throw new AppError('COUPON_NOT_FOUND', 'Coupon not found.', 404);
        }
        const beforeData = JSON.parse(JSON.stringify(coupon.toObject()));
        if (code)
            coupon.code = code;
        if (type) {
            if (type !== 'percentage' && type !== 'fixed') {
                throw new AppError('VALIDATION_FAILED', 'Type must be percentage or fixed.', 422);
            }
            coupon.type = type;
        }
        if (value !== undefined) {
            const val = parseFloat(value);
            if (isNaN(val) || val < 0) {
                throw new AppError('VALIDATION_FAILED', 'Value must be non-negative.', 422);
            }
            coupon.value = val;
        }
        if (minOrderValueCents !== undefined) {
            const min = parseInt(minOrderValueCents);
            if (isNaN(min) || min < 0) {
                throw new AppError('VALIDATION_FAILED', 'minOrderValueCents must be non-negative.', 422);
            }
            coupon.minOrderValueCents = min;
        }
        if (expiryDate) {
            coupon.expiryDate = new Date(expiryDate);
        }
        if (usageLimit !== undefined) {
            const limit = parseInt(usageLimit);
            if (isNaN(limit) || limit <= 0) {
                throw new AppError('VALIDATION_FAILED', 'usageLimit must be at least 1.', 422);
            }
            coupon.usageLimit = limit;
        }
        if (perUserLimit !== undefined) {
            const limit = parseInt(perUserLimit);
            if (isNaN(limit) || limit <= 0) {
                throw new AppError('VALIDATION_FAILED', 'perUserLimit must be at least 1.', 422);
            }
            coupon.perUserLimit = limit;
        }
        if (isActive !== undefined) {
            coupon.isActive = !!isActive;
        }
        await coupon.save();
        // Write Audit Log
        const actor = await User.findById(req.user.userId);
        await AuditLog.create({
            actorId: new mongoose.Types.ObjectId(req.user.userId),
            actorName: actor?.name || 'Inventory Manager',
            actionType: 'coupon_cud',
            targetEntityType: 'Coupon',
            targetEntityId: coupon._id,
            changeDelta: {
                before: beforeData,
                after: coupon.toObject(),
            },
        });
        res.status(200).json({
            success: true,
            data: coupon,
        });
    }
    catch (error) {
        next(error);
    }
};
// 5. DELETE /api/coupons/:id - Inventory Manager Only
export const deleteCoupon = async (req, res, next) => {
    try {
        if (!req.user) {
            throw new AppError('AUTH_UNAUTHORIZED', 'Session is not authenticated.', 401);
        }
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new AppError('VALIDATION_FAILED', 'Invalid coupon ID format.', 422);
        }
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            throw new AppError('COUPON_NOT_FOUND', 'Coupon not found.', 404);
        }
        const beforeData = JSON.parse(JSON.stringify(coupon.toObject()));
        await Coupon.deleteOne({ _id: id });
        // Write Audit Log
        const actor = await User.findById(req.user.userId);
        await AuditLog.create({
            actorId: new mongoose.Types.ObjectId(req.user.userId),
            actorName: actor?.name || 'Inventory Manager',
            actionType: 'coupon_cud',
            targetEntityType: 'Coupon',
            targetEntityId: new mongoose.Types.ObjectId(id),
            changeDelta: {
                before: beforeData,
                after: null,
            },
        });
        res.status(200).json({
            success: true,
            data: {
                message: 'Coupon deleted successfully.',
            },
        });
    }
    catch (error) {
        next(error);
    }
};
