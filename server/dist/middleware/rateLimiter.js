import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.js';
// Auth Limiter: 5 requests per 15 minutes per IP
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
        const error = new AppError('AUTH_RATE_LIMIT_EXCEEDED', 'Too many authentication attempts. Please try again in 15 minutes.', 429);
        next(error);
    },
});
// Coupon Apply Limiter: 20 requests per 15 minutes per authenticated user
export const couponApplyRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId || req.ip || 'anonymous';
    },
    handler: (req, res, next) => {
        const error = new AppError('COUPON_RATE_LIMIT_EXCEEDED', 'Too many coupon application attempts. Please try again in 15 minutes.', 429);
        next(error);
    },
});
// General API Limiter: 100 requests per 15 minutes per IP
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next) => {
        const error = new AppError('API_RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again in 15 minutes.', 429);
        next(error);
    },
});
