import { Router } from 'express';
import {
  createCheckoutSession,
  stripeWebhook,
  getOrderStatus,
  getOrders,
  getOrderDetails,
  updateOrderStatus,
} from '../controllers/order.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Stripe calls webhook directly — public, no auth
router.post('/webhook', stripeWebhook);

// Customer-scoped order routes
router.use(authenticate);

router.get('/', authorize('customer'), getOrders);
router.post('/checkout-session', authorize('customer'), createCheckoutSession);
router.get('/status/:paymentIntentId', authorize('customer'), getOrderStatus);
router.get('/:id', authorize('customer', 'inventory_manager', 'super_admin'), getOrderDetails);

// Inventory manager: advance order status
router.patch('/:id/status', authorize('inventory_manager', 'super_admin'), updateOrderStatus);

export default router;
