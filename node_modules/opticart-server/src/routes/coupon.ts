import { Router } from 'express';
import { applyCoupon, getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../controllers/coupon.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { couponApplyRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply Coupon endpoint (customer-scoped, rate-limited to 20 requests per 15 mins)
router.post('/apply', authenticate, authorize('customer'), couponApplyRateLimiter as any, applyCoupon);

// Manager CUD endpoints
router.get('/', authenticate, authorize('inventory_manager'), getCoupons);
router.post('/', authenticate, authorize('inventory_manager'), createCoupon);
router.patch('/:id', authenticate, authorize('inventory_manager'), updateCoupon);
router.delete('/:id', authenticate, authorize('inventory_manager'), deleteCoupon);

export default router;
