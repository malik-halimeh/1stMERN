import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.js';

// Auth Limiter: 10 attempts per 15 minutes per IP.
// skipSuccessfulRequests: true means a SUCCESSFUL login (2xx) is NOT counted —
// so switching between accounts never burns the budget; only failed attempts do.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    const error = new AppError(
      'AUTH_RATE_LIMIT_EXCEEDED',
      'Too many failed authentication attempts. Please try again in 15 minutes.',
      429
    );
    next(error);
  },
});


// Coupon Apply Limiter: 20 requests per 15 minutes per authenticated user
export const couponApplyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by userId when authenticated, fall back to IP.
  // validate: false disables the IPv6-keyGenerator warning in express-rate-limit v8
  // because our primary key is a userId string (not an IP address).
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => req.user?.userId || req.ip || 'anonymous',
  handler: (req, res, next) => {
    const error = new AppError(
      'COUPON_RATE_LIMIT_EXCEEDED',
      'Too many coupon application attempts. Please try again in 15 minutes.',
      429
    );
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
    const error = new AppError(
      'API_RATE_LIMIT_EXCEEDED',
      'Too many requests. Please try again in 15 minutes.',
      429
    );
    next(error);
  },
});
