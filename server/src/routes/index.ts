import { Router } from 'express';
import authRouter from './auth.js';
import productRouter from './product.js';
import categoryRouter from './category.js';
import cartRouter from './cart.js';
import wishlistRouter from './wishlist.js';
import couponRouter from './coupon.js';
import reviewRouter from './review.js';
import lowStockRouter from './lowStock.js';
import auditLogRouter from './auditLog.js';
import recommendationRouter from './recommendation.js';
import orderRouter from './order.js';
import productEventsRouter from './productEvents.js';
import { authenticate, authorize } from '../middleware/auth.js';
import userRouter from './user.js'
import analyticsRouter from './analytics.js'
import notificationRouter from './notification.js'

const router = Router();

// Base ping route
router.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: new Date() });
});

// 1. Authentication routes
router.use('/auth', authRouter);

// 2. Products routes
router.use('/products', productRouter);

// 3. Categories routes
router.use('/categories', categoryRouter);

// 4. Cart routes
router.use('/cart', cartRouter);

// 5. Wishlist routes
router.use('/wishlist', wishlistRouter);

// 6. Coupons routes
router.use('/coupons', couponRouter);

// 7. Reviews routes
router.use('/reviews', reviewRouter);

// 8. Low Stock alerts routes
router.use('/low-stock', lowStockRouter);

// 9. Audit Logs routes
router.use('/audit-logs', auditLogRouter);

// 10. Product Recommendations routes (read from cache — never compute sync)
router.use('/product-recommendations', recommendationRouter);

// 11. Orders and stripe transactional routes
router.use('/orders', orderRouter);

// 12. Product events (batched analytics writes — public, no auth required)
router.use('/product-events', productEventsRouter);

// 13. users
router.use('/users', userRouter)

// 14. analytics (super admin)
router.use('/analytics', analyticsRouter)

// 15. in-app notifications (order status updates, etc.)
router.use('/notifications', notificationRouter)


// Protected Stub Route to test access + RBAC (only accessible to Super Admins)
router.get(
  '/admin-stub',
  authenticate,
  authorize('super_admin'),
  (req, res) => {
    res.json({
      success: true,
      data: {
        message: 'Super Admin credentials verified. Protected stub access granted.',
        userId: req.user?.userId,
        role: req.user?.role,
      },
    });
  }
);

export default router;
