import { Router } from 'express';
import { applyCoupon, getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../controllers/coupon.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { couponApplyRateLimiter } from '../middleware/rateLimiter.js';
const router = Router();
// Apply Coupon endpoint (any authenticated shopper, rate-limited to 20 requests per 15 mins)
router.post('/apply', authenticate, authorize('customer', 'inventory_manager', 'super_admin'), couponApplyRateLimiter, applyCoupon);
// Staff CUD endpoints (inventory managers and super admins have equal access)
router.get('/', authenticate, authorize('inventory_manager', 'super_admin'), getCoupons);
router.post('/', authenticate, authorize('inventory_manager', 'super_admin'), createCoupon);
router.patch('/:id', authenticate, authorize('inventory_manager', 'super_admin'), updateCoupon);
router.delete('/:id', authenticate, authorize('inventory_manager', 'super_admin'), deleteCoupon);
export default router;
